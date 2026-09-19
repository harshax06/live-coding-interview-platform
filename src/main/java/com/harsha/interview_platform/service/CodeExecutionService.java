package com.harsha.interview_platform.service;

import com.harsha.interview_platform.dto.request.ExecutionResult;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

@Service
public class CodeExecutionService {

    private static final int TIMEOUT_SECONDS = 10;

    private final ExecutorService streamReaderPool =
            Executors.newFixedThreadPool(2);

    public ExecutionResult execute(String code) {

        Path tempFile = null;
        Process process = null;

        try {

            tempFile = Files.createTempFile(
                    "exec-" + UUID.randomUUID(),
                    ".py"
            );

            Files.writeString(tempFile, code);

            List<String> command = buildDockerCommand(tempFile);

            ProcessBuilder processBuilder =
                    new ProcessBuilder(command);

            process = processBuilder.start();

            Process startedProcess = process;

            Future<String> stdoutFuture =
                    streamReaderPool.submit(
                            () -> readStream(
                                    startedProcess.getInputStream()
                            )
                    );

            Future<String> stderrFuture =
                    streamReaderPool.submit(
                            () -> readStream(
                                    startedProcess.getErrorStream()
                            )
                    );

            boolean finished =
                    startedProcess.waitFor(
                            TIMEOUT_SECONDS,
                            TimeUnit.SECONDS
                    );

            if (!finished) {

                startedProcess.destroyForcibly();

                return new ExecutionResult(
                        "",
                        "Execution timed out after "
                                + TIMEOUT_SECONDS + "s",
                        -1,
                        true
                );
            }

            String stdout =
                    stdoutFuture.get(2, TimeUnit.SECONDS);

            String stderr =
                    stderrFuture.get(2, TimeUnit.SECONDS);

            return new ExecutionResult(
                    stdout,
                    stderr,
                    startedProcess.exitValue(),
                    false
            );

        } catch (Exception e) {

            return new ExecutionResult(
                    "",
                    "Execution error: " + e.getMessage(),
                    -1,
                    false
            );

        } finally {

            if (process != null) {
                process.destroyForcibly();
            }

            if (tempFile != null) {

                try {
                    Files.deleteIfExists(tempFile);
                } catch (Exception ignored) {
                }
            }
        }
    }

    private List<String> buildDockerCommand(Path tempFile) {

        List<String> command = new ArrayList<>();

        command.add("docker");
        command.add("run");

        command.add("--rm");

        command.add("--network");
        command.add("none");

        command.add("--memory=128m");

        command.add("--cpus=0.5");

        command.add("--pids-limit=50");

        command.add("--read-only");

        command.add("--user");
        command.add("1000:1000");

        command.add("-v");
        command.add(
                tempFile.toAbsolutePath()
                        + ":/sandbox/script.py:ro"
        );

        command.add("--workdir");
        command.add("/sandbox");

        command.add("python:3.11-slim");

        command.add("python");
        command.add("script.py");

        return command;
    }

    private String readStream(InputStream inputStream)
            throws Exception {

        StringBuilder output = new StringBuilder();

        try (
                BufferedReader reader =
                        new BufferedReader(
                                new InputStreamReader(inputStream)
                        )
        ) {

            String line;

            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
        }

        return output.toString();
    }
}