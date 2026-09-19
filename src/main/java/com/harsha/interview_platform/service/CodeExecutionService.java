package com.harsha.interview_platform.service;

import com.harsha.interview_platform.dto.request.ExecutionResult;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

@Service
public class CodeExecutionService {

    private static final int MAX_OUTPUT_CHARS = 64 * 1024;

    // Cached pool: each run uses 2 reader threads, a fixed pool of 2 would serialize concurrent runs
    private final ExecutorService streamReaderPool = Executors.newCachedThreadPool();

    public ExecutionResult execute(String languageId, String code) {

        LanguageConfig lang;
        try {
            lang = Languages.get(languageId == null || languageId.isBlank() ? "python" : languageId);
        } catch (IllegalArgumentException e) {
            return new ExecutionResult("", e.getMessage(), -1, false);
        }

        Path dir = null;
        Process process = null;
        String containerName = "sbx-" + UUID.randomUUID();

        try {
            dir = Files.createTempDirectory("exec-");
            // Container user (1000) must be able to read the mount regardless of host uid
            makeWorldReadable(dir, "rwxr-xr-x");
            Path src = dir.resolve(lang.fileName());
            Files.writeString(src, code, StandardCharsets.UTF_8);
            makeWorldReadable(src, "rw-r--r--");

            process = new ProcessBuilder(buildDockerCommand(lang, containerName, dir)).start();
            Process started = process;
            started.getOutputStream().close();

            Future<String> stdoutFuture = streamReaderPool.submit(() -> readStream(started.getInputStream()));
            Future<String> stderrFuture = streamReaderPool.submit(() -> readStream(started.getErrorStream()));

            boolean finished = started.waitFor(lang.timeoutSeconds(), TimeUnit.SECONDS);

            if (!finished) {
                // Killing the docker CLI does not stop the container; kill it by name
                killContainer(containerName);
                started.destroyForcibly();
                return new ExecutionResult(
                        "",
                        "Execution timed out after " + lang.timeoutSeconds() + "s",
                        -1,
                        true);
            }

            String stdout = stdoutFuture.get(2, TimeUnit.SECONDS);
            String stderr = stderrFuture.get(2, TimeUnit.SECONDS);
            return new ExecutionResult(stdout, stderr, started.exitValue(), false);

        } catch (Exception e) {
            e.printStackTrace(); // some exceptions (e.g. TimeoutException) have a null message
            return new ExecutionResult("",
                    "Execution error: " + e.getClass().getSimpleName() + ": " + e.getMessage(),
                    -1, false);

        } finally {
            if (process != null) process.destroyForcibly();
            deleteRecursively(dir);
        }
    }

    private List<String> buildDockerCommand(LanguageConfig lang, String name, Path hostDir) {
        List<String> c = new ArrayList<>();
        c.add("docker"); c.add("run"); c.add("--rm");
        c.add("--name"); c.add(name);
        c.add("--network"); c.add("none");
        c.add("--read-only");
        // Narrow loosening: only /tmp, writable + exec, small, for compiled output
        c.add("--tmpfs"); c.add("/tmp:rw,exec,size=64m");
        c.add("--memory=" + lang.memoryMb() + "m");
        c.add("--memory-swap=" + lang.memoryMb() + "m");
        c.add("--cpus=1");
        c.add("--pids-limit=" + lang.pidsLimit());
        c.add("--cap-drop=ALL");
        c.add("--security-opt"); c.add("no-new-privileges");
        c.add("--user"); c.add("1000:1000");
        c.add("-v"); c.add(hostDir.toAbsolutePath() + ":/sandbox:ro");
        c.add("--workdir"); c.add("/tmp");
        c.add(lang.image());
        c.addAll(lang.containerCommand());
        return c;
    }

    /** POSIX permissions only exist on Linux/macOS; on Windows Docker Desktop handles bind-mount access itself. */
    private void makeWorldReadable(Path path, String perms) {
        try {
            Files.setPosixFilePermissions(path, PosixFilePermissions.fromString(perms));
        } catch (UnsupportedOperationException | java.io.IOException ignored) {
        }
    }

    private void killContainer(String name) {
        try {
            new ProcessBuilder("docker", "kill", name).start().waitFor(5, TimeUnit.SECONDS);
        } catch (Exception ignored) {
        }
    }

    /** Keeps at most MAX_OUTPUT_CHARS but keeps draining so the process never blocks on a full pipe. */
    private String readStream(InputStream inputStream) throws Exception {
        StringBuilder output = new StringBuilder();
        boolean truncated = false;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            char[] buf = new char[4096];
            int n;
            while ((n = reader.read(buf)) != -1) {
                int room = MAX_OUTPUT_CHARS - output.length();
                if (room > 0) output.append(buf, 0, Math.min(n, room));
                if (n > room) truncated = true;
            }
        }
        if (truncated) output.append("\n[output truncated]");
        return output.toString();
    }

    private void deleteRecursively(Path dir) {
        if (dir == null) return;
        try (var walk = Files.walk(dir)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
        } catch (Exception ignored) {
        }
    }
}