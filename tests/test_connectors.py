"""Connector sandbox + permit-gate tests."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from connectors import ConnectorError, GitConnector, JiraConnector
from controlplane.enforcement import issue_signed_capability_token


def _permit(tool: str, action: str) -> str:
    return issue_signed_capability_token(
        run_id="run-test",
        organization_id="org-test",
        tool=tool,
        action=action,
    )


def test_connector_refuses_without_capability_permit(tmp_path: Path):
    repo = tmp_path / "repo"
    repo.mkdir()
    git = GitConnector(str(repo))
    with pytest.raises(ConnectorError, match="capability permit"):
        git.execute("read_file", {"path": "a.txt"})


def test_connector_refuses_forged_capability_permit(tmp_path: Path):
    repo = tmp_path / "repo"
    repo.mkdir()
    git = GitConnector(str(repo))
    with pytest.raises(ConnectorError, match="invalid capability permit"):
        git.execute("status", {}, capability_token="forged.not-a-real-signature")


def test_git_path_escape_blocked(tmp_path: Path):
    repo = tmp_path / "repo"
    repo.mkdir()
    git = GitConnector(str(repo))
    with pytest.raises(ConnectorError):
        git.execute(
            "read_file",
            {"path": "../secret.txt"},
            capability_token=_permit("git", "read_file"),
        )


def test_jira_mock_ticket():
    jira = JiraConnector()
    issue = jira.execute(
        "get_issue",
        {"key": "AUTO-42"},
        capability_token=_permit("jira", "get_issue"),
    )
    assert issue["issue"]["key"] == "AUTO-42"


def test_git_write_and_read(tmp_path: Path):
    repo = tmp_path / "repo"
    repo.mkdir()
    subprocess.run(["git", "init"], cwd=repo, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "t@t"], cwd=repo, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.name", "t"], cwd=repo, check=True, capture_output=True)
    git = GitConnector(str(repo))
    git.execute(
        "write_file",
        {"path": "a.txt", "content": "hello"},
        capability_token=_permit("git", "write_file"),
    )
    read = git.execute(
        "read_file",
        {"path": "a.txt"},
        capability_token=_permit("git", "read_file"),
    )
    assert read["content"] == "hello"
