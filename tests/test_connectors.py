"""Connector sandbox tests."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from connectors import ConnectorError, GitConnector, JiraConnector


def test_git_path_escape_blocked(tmp_path: Path):
    repo = tmp_path / "repo"
    repo.mkdir()
    git = GitConnector(str(repo))
    with pytest.raises(ConnectorError):
        git.execute("read_file", {"path": "../secret.txt"})


def test_jira_mock_ticket():
    jira = JiraConnector()
    issue = jira.execute("get_issue", {"key": "AUTO-42"})
    assert issue["issue"]["key"] == "AUTO-42"


def test_git_write_and_read(tmp_path: Path):
    import subprocess

    repo = tmp_path / "repo"
    repo.mkdir()
    subprocess.run(["git", "init"], cwd=repo, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "t@t"], cwd=repo, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.name", "t"], cwd=repo, check=True, capture_output=True)
    git = GitConnector(str(repo))
    git.execute("write_file", {"path": "a.txt", "content": "hello"})
    read = git.execute("read_file", {"path": "a.txt"})
    assert read["content"] == "hello"
