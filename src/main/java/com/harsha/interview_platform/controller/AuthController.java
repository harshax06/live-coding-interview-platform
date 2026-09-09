package com.harsha.interview_platform.controller;

import com.harsha.interview_platform.dto.request.LoginRequest;
import com.harsha.interview_platform.dto.request.SignupRequest;
import com.harsha.interview_platform.dto.response.AuthResponse;
import com.harsha.interview_platform.entity.Role;
import com.harsha.interview_platform.entity.User;
import com.harsha.interview_platform.repository.UserRepository;
import com.harsha.interview_platform.security.JwtUtil;
import com.harsha.interview_platform.security.TokenClaims;
import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

@RestController
@RequestMapping("/auth")
@AllArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@Valid @RequestBody SignupRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            return ResponseEntity.status(409).body("Email already registered");
        }

        User user = new User();
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setName(request.getName());
        user.setRole(Role.CANDIDATE);

        userRepository.save(user);

        TokenClaims tokenClaims = new TokenClaims(user.getId(),user.getEmail(),user.getRole().name()) ;

        String token = jwtUtil.generateToken(tokenClaims);
        return ResponseEntity.ok(new AuthResponse(token));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        Optional<User> userOpt = userRepository.findByEmail(request.getEmail());

        if (userOpt.isEmpty() || !passwordEncoder.matches(request.getPassword(), userOpt.get().getPasswordHash())) {
            return ResponseEntity.status(401).body("Invalid email or password");
        }

        User user = userOpt.get() ;

        TokenClaims tokenClaims = new TokenClaims(user.getId(),user.getEmail(),user.getRole().name()) ;

        String token = jwtUtil.generateToken(tokenClaims);
        return ResponseEntity.ok(new AuthResponse(token));
    }

}
