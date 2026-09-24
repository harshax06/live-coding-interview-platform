package com.harsha.interview_platform.repository;

import com.harsha.interview_platform.entity.Room;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoomRepository extends JpaRepository<Room, Long> {
    Optional<Room> findByJoinCode(String joinCode);

    // Day 41 (UI/UX pass): a signed-in interviewer's own created rooms, newest first
    List<Room> findByCreatedByIdOrderByCreatedAtDesc(Long createdById);
}