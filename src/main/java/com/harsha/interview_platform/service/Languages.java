package com.harsha.interview_platform.service;

import java.util.Map;

public final class Languages {

    private Languages() {}

    private static final Map<String, LanguageConfig> REGISTRY = Map.of(
            "python", new LanguageConfig("python", "python:3.11-slim", "main.py",
                    null,
                    "python -B /sandbox/main.py",
                    10, 128, 50),

            "javascript", new LanguageConfig("javascript", "node:20-alpine", "main.js",
                    null,
                    "node /sandbox/main.js",
                    10, 128, 50),

            // Candidate code must declare `public class Main`; file is always Main.java
            "java", new LanguageConfig("java", "eclipse-temurin:21-jdk", "Main.java",
                    "javac -d /tmp /sandbox/Main.java",
                    "java -Xmx128m -XX:+UseSerialGC -cp /tmp Main",
                    15, 512, 128),

            "cpp", new LanguageConfig("cpp", "gcc:13", "main.cpp",
                    "g++ -O1 -std=c++17 -o /tmp/program /sandbox/main.cpp",
                    "/tmp/program",
                    15, 256, 64),

            "c", new LanguageConfig("c", "gcc:13", "main.c",
                    "gcc -O1 -std=c11 -o /tmp/program /sandbox/main.c -lm",
                    "/tmp/program",
                    15, 256, 64)
    );

    public static LanguageConfig get(String id) {
        LanguageConfig cfg = id == null ? null : REGISTRY.get(id.trim().toLowerCase());
        if (cfg == null) {
            throw new IllegalArgumentException("Unsupported language: " + id);
        }
        return cfg;
    }
}