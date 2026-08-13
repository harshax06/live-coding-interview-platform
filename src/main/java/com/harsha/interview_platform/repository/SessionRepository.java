package com.harsha.interview_platform.repository;

import com.harsha.interview_platform.entity.Session;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SessionRepository extends JpaRepository<Session,Long> {
    List<Session> findByRoomId(Long roomId) ;
    List<Session> findByCandidateIdOrInterviewerId(Long candidateId, Long interviewerId) ;
}
