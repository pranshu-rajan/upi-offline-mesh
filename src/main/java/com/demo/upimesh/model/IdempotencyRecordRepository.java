package com.demo.upimesh.model;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface IdempotencyRecordRepository extends JpaRepository<IdempotencyRecord, String> {
    List<IdempotencyRecord> findByClaimedAtAfter(Instant cutoff);
    long deleteByClaimedAtBefore(Instant cutoff);
}

