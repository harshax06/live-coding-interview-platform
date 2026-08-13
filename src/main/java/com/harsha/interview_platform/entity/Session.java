package com.harsha.interview_platform.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "sessions")
@Getter
@Setter
public class Session {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id ;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id" , nullable = false)
    private Room room ;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "interviewer_id" , nullable = false)
    private User interviewer ;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id" , nullable = false)
    private User candidate ;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SessionStatus sessionStatus ;

    private Instant startedAt ;
    private Instant endedAt ;
}
