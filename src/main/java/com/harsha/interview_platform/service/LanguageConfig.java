package com.harsha.interview_platform.service;

import java.util.List;

/**
 * compileCommand == null -> interpreted, runCommand is exec'd directly (no shell).
 * compileCommand != null -> compiled, "compile && run" inside one `sh -c`.
 */
public record LanguageConfig(
        String id,
        String image,
        String fileName,
        String compileCommand,
        String runCommand,
        int timeoutSeconds,
        int memoryMb,
        int pidsLimit) {

    public boolean isCompiled() {
        return compileCommand != null;
    }

    public List<String> containerCommand() {
        if (isCompiled()) {
            return List.of("sh", "-c", compileCommand + " && " + runCommand);
        }
        return List.of(runCommand.split("\\s+"));
    }
}