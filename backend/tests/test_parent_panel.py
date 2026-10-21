"""Parent (Veli) panel end-to-end tests — additive; verifies parent RBAC + read-only view.

Covers:
- Parent register/login/me (role=parent, no grade)
- POST /parent/connect happy path, 404 wrong code, 400 duplicate
- GET /parent/children weekly summary
- GET /parent/children/{id} returns stats+records+goals+coach
- 403 for child not linked
- GET /parent/children/{id}/comments read-only view of coach messages
- RBAC: parent role gets 403 on coach & student write endpoints
- Multi-parent for one student & multi-child for one parent
- Regression: existing student/coach connection flow still works after parent additions
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://duzeyde-git.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _uid() -> str:
    return uuid.uuid4().hex[:8]


def _register(role: str, grade: int | None = None):
    email = f"TEST_{role}_{_uid()}@test.com"
    payload = {"name": f"Test {role}", "email": email, "password": "123456", "role": role}
    if grade is not None:
        payload["grade"] = grade
    r = requests.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code == 200, f"register {role} failed: {r.status_code} {r.text}"
    data = r.json()
    return {"token": data["session_token"], "user": data["user"], "email": email}


def h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def student_a():
    return _register("student", grade=8)


@pytest.fixture(scope="module")
def student_b():
    return _register("student", grade=7)


@pytest.fixture(scope="module")
def parent_a():
    return _register("parent")


@pytest.fixture(scope="module")
def parent_b():
    return _register("parent")


@pytest.fixture(scope="module")
def coach_a():
    return _register("coach")


# ---------- Parent auth ----------
class TestParentAuth:
    def test_register_parent_no_grade(self):
        p = _register("parent")
        assert p["user"]["role"] == "parent"
        assert p["user"].get("grade") in (None,)
        # Parent must not receive student_code
        assert not p["user"].get("student_code")

    def test_login_parent(self, parent_a):
        r = requests.post(f"{API}/auth/login", json={"email": parent_a["email"], "password": "123456"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "parent"

    def test_me_parent(self, parent_a):
        r = requests.get(f"{API}/auth/me", headers=h(parent_a["token"]), timeout=15)
        assert r.status_code == 200
        payload = r.json()
        me = payload.get("user", payload)
        assert me["role"] == "parent"
        assert me.get("grade") in (None,)


# ---------- Parent connect ----------
class TestParentConnect:
    def test_connect_wrong_code_404(self, parent_a):
        r = requests.post(f"{API}/parent/connect", json={"student_code": "OGR-XXXXXX"}, headers=h(parent_a["token"]), timeout=15)
        assert r.status_code == 404, r.text

    def test_connect_ok(self, parent_a, student_a):
        code = student_a["user"]["student_code"]
        r = requests.post(f"{API}/parent/connect", json={"student_code": code}, headers=h(parent_a["token"]), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_connect_duplicate_400(self, parent_a, student_a):
        code = student_a["user"]["student_code"]
        r = requests.post(f"{API}/parent/connect", json={"student_code": code}, headers=h(parent_a["token"]), timeout=15)
        assert r.status_code == 400, r.text

    def test_multi_parent_same_student(self, parent_b, student_a):
        # A second parent can connect to the same student
        code = student_a["user"]["student_code"]
        r = requests.post(f"{API}/parent/connect", json={"student_code": code}, headers=h(parent_b["token"]), timeout=15)
        assert r.status_code == 200, r.text

    def test_multi_child_same_parent(self, parent_a, student_b):
        # parent_a can also connect to a second student
        code = student_b["user"]["student_code"]
        r = requests.post(f"{API}/parent/connect", json={"student_code": code}, headers=h(parent_a["token"]), timeout=15)
        assert r.status_code == 200, r.text

    def test_connect_requires_parent_role(self, student_a):
        # student token trying to connect -> 403
        r = requests.post(f"{API}/parent/connect", json={"student_code": "OGR-XYZ"}, headers=h(student_a["token"]), timeout=15)
        assert r.status_code == 403, r.text


# ---------- Parent children list ----------
class TestParentChildren:
    def test_list_children(self, parent_a, student_a, student_b):
        r = requests.get(f"{API}/parent/children", headers=h(parent_a["token"]), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "children" in data
        ids = [c["user_id"] for c in data["children"]]
        assert student_a["user"]["user_id"] in ids
        assert student_b["user"]["user_id"] in ids
        # weekly summary keys
        for c in data["children"]:
            for k in ("week_questions", "days_studied"):
                assert k in c, f"missing key {k} in {c}"
            # last_study may be None if no records yet
            assert "last_study" in c


# ---------- Parent child detail ----------
class TestParentChildDetail:
    def test_child_detail_ok(self, parent_a, student_a):
        sid = student_a["user"]["user_id"]
        r = requests.get(f"{API}/parent/children/{sid}", headers=h(parent_a["token"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("student", "stats", "records", "goals", "coach"):
            assert k in d, f"missing key {k}"
        assert d["student"]["user_id"] == sid

    def test_child_detail_forbidden(self, parent_b, student_b):
        # parent_b is only connected to student_a, not student_b
        sid = student_b["user"]["user_id"]
        r = requests.get(f"{API}/parent/children/{sid}", headers=h(parent_b["token"]), timeout=15)
        assert r.status_code == 403, r.text

    def test_child_comments_ok(self, parent_a, student_a):
        sid = student_a["user"]["user_id"]
        r = requests.get(f"{API}/parent/children/{sid}/comments", headers=h(parent_a["token"]), timeout=15)
        assert r.status_code == 200, r.text
        assert "comments" in r.json()

    def test_child_comments_forbidden(self, parent_b, student_b):
        sid = student_b["user"]["user_id"]
        r = requests.get(f"{API}/parent/children/{sid}/comments", headers=h(parent_b["token"]), timeout=15)
        assert r.status_code == 403


# ---------- Parent RBAC — read-only ----------
class TestParentRBAC:
    def test_parent_cannot_post_study_record(self, parent_a):
        payload = {"subject": "Matematik", "questions": 10, "duration_minutes": 30, "study_date": "2026-01-15"}
        r = requests.post(f"{API}/study-records", json=payload, headers=h(parent_a["token"]), timeout=15)
        assert r.status_code == 403, r.text

    def test_parent_cannot_get_stats(self, parent_a):
        r = requests.get(f"{API}/stats", headers=h(parent_a["token"]), timeout=15)
        assert r.status_code == 403, r.text

    def test_parent_cannot_set_goal(self, parent_a, student_a):
        sid = student_a["user"]["user_id"]
        payload = {"period": "daily", "subject": "Matematik", "target_questions": 30}
        r = requests.post(f"{API}/coach/students/{sid}/goals", json=payload, headers=h(parent_a["token"]), timeout=15)
        assert r.status_code == 403, r.text

    def test_parent_cannot_comment(self, parent_a, student_a):
        sid = student_a["user"]["user_id"]
        r = requests.post(f"{API}/coach/students/{sid}/comments", json={"text": "hi"}, headers=h(parent_a["token"]), timeout=15)
        assert r.status_code == 403, r.text


# ---------- Regression: coach connection + comment flow ----------
class TestRegressionCoachFlow:
    def test_coach_request_accept_and_comment(self, coach_a, student_a, parent_a):
        # Coach requests student
        code = student_a["user"]["student_code"]
        r = requests.post(f"{API}/connections/request", json={"student_code": code}, headers=h(coach_a["token"]), timeout=15)
        assert r.status_code == 200, r.text
        # Student sees pending & accepts
        r = requests.get(f"{API}/connections/pending", headers=h(student_a["token"]), timeout=15)
        assert r.status_code == 200
        pending = r.json().get("connections", [])
        assert len(pending) >= 1
        req_id = pending[0]["id"]
        r = requests.post(f"{API}/connections/{req_id}/accept", headers=h(student_a["token"]), timeout=15)
        assert r.status_code == 200, r.text
        # Coach lists students
        r = requests.get(f"{API}/coach/students", headers=h(coach_a["token"]), timeout=15)
        assert r.status_code == 200
        ids = [s["user_id"] for s in r.json().get("students", [])]
        assert student_a["user"]["user_id"] in ids
        # Coach writes a comment
        sid = student_a["user"]["user_id"]
        r = requests.post(f"{API}/coach/students/{sid}/comments", json={"text": "Aferin!"}, headers=h(coach_a["token"]), timeout=15)
        assert r.status_code == 200, r.text
        # Parent can see it via parent endpoint
        r = requests.get(f"{API}/parent/children/{sid}/comments", headers=h(parent_a["token"]), timeout=15)
        assert r.status_code == 200
        comments = r.json().get("comments", [])
        assert any(c.get("text") == "Aferin!" for c in comments), f"parent didn't see coach comment: {comments}"

    def test_student_can_still_log_study(self, student_a):
        from datetime import date
        payload = {"subject": "Matematik", "questions": 12, "duration_minutes": 20, "study_date": date.today().isoformat()}
        r = requests.post(f"{API}/study-records", json=payload, headers=h(student_a["token"]), timeout=15)
        assert r.status_code == 200, r.text

    def test_parent_children_reflects_activity(self, parent_a, student_a):
        # After student logs study, week_questions should reflect it
        r = requests.get(f"{API}/parent/children", headers=h(parent_a["token"]), timeout=15)
        assert r.status_code == 200
        for c in r.json()["children"]:
            if c["user_id"] == student_a["user"]["user_id"]:
                assert c["week_questions"] >= 12
                break
        else:
            pytest.fail("student_a not found in parent's children list")


# ---------- Profile counts children for parent ----------
class TestParentProfile:
    def test_profile_children_count(self, parent_a):
        r = requests.get(f"{API}/profile", headers=h(parent_a["token"]), timeout=15)
        assert r.status_code == 200, r.text
        prof = r.json()
        assert prof.get("role") == "parent"
        # parent_a has 2 children (student_a + student_b)
        assert prof.get("children_count", 0) >= 2, prof


# ---------- Unlink ----------
class TestParentUnlink:
    def test_unlink(self, student_b):
        # Register a fresh parent, connect+unlink+verify 403 on detail
        p = _register("parent")
        code = student_b["user"]["student_code"]
        r = requests.post(f"{API}/parent/connect", json={"student_code": code}, headers=h(p["token"]), timeout=15)
        assert r.status_code == 200
        sid = student_b["user"]["user_id"]
        r = requests.delete(f"{API}/parent/children/{sid}", headers=h(p["token"]), timeout=15)
        assert r.status_code == 200
        r = requests.get(f"{API}/parent/children/{sid}", headers=h(p["token"]), timeout=15)
        assert r.status_code == 403
