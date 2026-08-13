package com.harsha.interview_platform.repository;

import com.harsha.interview_platform.entity.Room;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RoomRepository extends JpaRepository<Room,Long> {
    Optional<Room> findByJoinCode(String joinCode) ;
}
