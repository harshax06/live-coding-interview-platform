package com.harsha.interview_platform.controller;

import com.harsha.interview_platform.dto.response.RoomResponse;
import com.harsha.interview_platform.entity.Role;
import com.harsha.interview_platform.entity.Room;
import com.harsha.interview_platform.entity.User;
import com.harsha.interview_platform.repository.RoomRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.util.List;
import java.util.Optional;

/**
 * Backs the room-creation flow the frontend router already expects (CreateRoomPage,
 * JoinPage, Dashboard's "new session" action): an interviewer creates a room and gets a
 * short joinCode to share; anyone signed in can resolve that code before entering the
 * live room. This is the STOMP layer's roomCode (RunRequest, SessionEvent, etc.) - creating
 * one here doesn't touch Kafka/Redis at all, it just reserves the code and records who owns it.
 */
@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    // Unambiguous alphabet: no 0/O, 1/I/L, so a spoken or handwritten code is never confusable
    private static final String CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 6;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RoomRepository roomRepository;

    public RoomController(RoomRepository roomRepository) {
        this.roomRepository = roomRepository;
    }

    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal User user) {
        if (user.getRole() != Role.INTERVIEWER) {
            return ResponseEntity.status(403).body("Only an interviewer can create a room");
        }

        Room room = new Room();
        room.setJoinCode(generateUniqueCode());
        room.setCreatedBy(user);
        roomRepository.save(room);

        return ResponseEntity.status(201).body(new RoomResponse(room));
    }

    @GetMapping("/{joinCode}")
    public ResponseEntity<?> resolve(@PathVariable String joinCode) {
        Optional<Room> room = roomRepository.findByJoinCode(joinCode.trim().toUpperCase());
        if (room.isEmpty()) {
            return ResponseEntity.status(404).body("No room found for that code");
        }
        return ResponseEntity.ok(new RoomResponse(room.get()));
    }

    @GetMapping("/mine")
    public ResponseEntity<?> mine(@AuthenticationPrincipal User user) {
        if (user.getRole() != Role.INTERVIEWER) {
            return ResponseEntity.status(403).body("Only an interviewer has rooms to list");
        }
        List<RoomResponse> rooms = roomRepository.findByCreatedByIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(RoomResponse::new)
                .toList();
        return ResponseEntity.ok(rooms);
    }

    // Collisions are vanishingly unlikely at this alphabet/length, but check-and-retry costs
    // nothing and turns "vanishingly unlikely" into "actually impossible to see in production"
    private String generateUniqueCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder sb = new StringBuilder(CODE_LENGTH);
            for (int i = 0; i < CODE_LENGTH; i++) {
                sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
            }
            String code = sb.toString();
            if (roomRepository.findByJoinCode(code).isEmpty()) return code;
        }
        throw new IllegalStateException("Could not generate a unique room code - try again");
    }
}