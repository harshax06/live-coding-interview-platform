package com.harsha.interview_platform.security;

public record TokenClaims(Long userId, String email, String role) {

}