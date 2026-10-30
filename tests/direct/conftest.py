"""Shared helpers for Whistle Quorum direct-mode tests."""

import json

GEN = 10**18
RULEBOOK = "football_ifab_v1"

OFFICIAL_URL = "https://official.example.com/match-1"
FRAME_URL = "https://cdn.example.com/frame-1.jpg"
REPORT_URL = "https://reports.example.com/incident-1"
COUNTER_URL = "https://cdn.example.com/frame-2.jpg"
APPEAL_URL = "https://archive.example.com/frame-3.jpg"


def addr(value):
    """Return the checksummed hex string for a test address object."""
    if hasattr(value, "as_hex"):
        return value.as_hex
    from genlayer.py.types import Address

    return Address(value).as_hex


def verdict(**overrides):
    base = {
        "outcome": "CLAIM_UPHELD",
        "incident_type": "GOAL_LINE",
        "recommended_action": "AWARD_GOAL",
        "confidence": 86,
        "evidence_quality": "STRONG",
        "corroboration": True,
        "contradiction": False,
        "sources": [OFFICIAL_URL, FRAME_URL, REPORT_URL, COUNTER_URL],
        "findings": [
            "The ball is fully behind the line in frame 1.",
            "The assistant referee's position does not affect the factual question.",
        ],
        "rules_cited": ["whole ball has crossed the goal line"],
        "manipulation_suspected": False,
    }
    base.update(overrides)
    return base


def register_web_mocks(vm, include_appeal=False):
    jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"
    vm.mock_web(
        r"https://official\.example\.com/match-1",
        {"status": 200, "body": "Official match report. Final score 2-1."},
    )
    vm.mock_web(
        r"https://cdn\.example\.com/frame-1\.jpg",
        {"status": 200, "body": jpeg},
    )
    vm.mock_web(
        r"https://reports\.example\.com/incident-1",
        {"status": 200, "body": "Widely reported: the ball crossed the line."},
    )
    vm.mock_web(
        r"https://cdn\.example\.com/frame-2\.jpg",
        {"status": 200, "body": jpeg},
    )
    if include_appeal:
        vm.mock_web(
            r"https://archive\.example\.com/frame-3\.jpg",
            {"status": 200, "body": jpeg},
        )


def register_llm_mock(vm, payload=None):
    vm.mock_llm(r"You are WHISTLE QUORUM", json.dumps(payload or verdict()))


def deploy(direct_deploy):
    return direct_deploy("contracts/whistle_quorum.py", "")


def create_match(contract, vm, owner, alice, bob):
    vm.sender = owner
    contract.create_match(
        "match-1",
        RULEBOOK,
        "Test Cup",
        "Rovers",
        "United",
        addr(alice),
        addr(bob),
        "2026-10-29T19:00:00Z",
        OFFICIAL_URL,
    )


def file_dispute(contract, vm, alice):
    vm.sender = alice
    vm.value = GEN
    contract.file_dispute(
        "match-1",
        "GOAL_LINE",
        67,
        "The ball crossed the line before the clearance; the goal should stand.",
        FRAME_URL + "," + REPORT_URL,
    )
    vm.value = 0


def submit_counter(contract, vm, bob):
    vm.sender = bob
    contract.submit_counter_evidence(
        "match-1#1",
        COUNTER_URL,
        "The angle is deceptive because the camera is behind the post.",
    )


def review(contract, vm, verdict_payload=None, include_appeal=False):
    register_web_mocks(vm, include_appeal=include_appeal)
    register_llm_mock(vm, verdict_payload)
    contract.review_dispute("match-1#1")


def appeal(contract, vm, bob, grounds="The new angle clearly shows the ball stayed in play."):
    vm.sender = bob
    vm.value = 2 * GEN
    contract.appeal("match-1#1", APPEAL_URL, grounds)
    vm.value = 0
