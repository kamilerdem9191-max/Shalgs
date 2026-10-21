"""End-to-end backend tests for ŞHA LGS Koçu API."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://duzeyde-git.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _uid() -> str:
    return uuid.uuid4().hex[:8]


@pytest.fixture(scope="module")
def student():
    email = f"TEST_stu_{_uid()}@test.com"
    r = requests.post(f"{API}/auth/register", json={
        "name": "Test Öğrenci", "email": email, "password": "123456",
        "role": "student", "grade": 8,
    }, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "session_token" in data
    assert data["user"]["role"] == "student"
    assert data["user"]["student_code"] and data["user"]["student_code"].startswith("OGR-")
    return {"token": data["session_token"], "user": data["user"], "email": email}


@pytest.fixture(scope="module")
def coach():
    email = f"TEST_koc_{_uid()}@test.com"
    r = requests.post(f"{API}/auth/register", json={
        "name": "Test Koç", "email": email, "password": "123456", "role": "coach",
    }, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["session_token"], "user": data["user"], "email": email}


def h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------- Auth ----------------
class TestAuth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert "message" in r.json()

    def test_me_unauthorized(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_login(self, student):
        r = requests.post(f"{API}/auth/login", json={
            "email": student["email"], "password": "123456"
        }, timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == student["email"].lower()

    def test_login_bad(self, student):
        r = requests.post(f"{API}/auth/login", json={
            "email": student["email"], "password": "wrong"
        }, timeout=15)
        assert r.status_code == 401

    def test_me(self, student):
        r = requests.get(f"{API}/auth/me", headers=h(student["token"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "student"

    def test_register_duplicate_email(self, student):
        r = requests.post(f"{API}/auth/register", json={
            "name": "X", "email": student["email"], "password": "123456",
            "role": "student", "grade": 8,
        }, timeout=15)
        assert r.status_code == 400


# ---------------- Study records ----------------
class TestStudyRecords:
    def test_create_and_list(self, student):
        r = requests.post(f"{API}/study-records", headers=h(student["token"]),
                          json={"subject": "Matematik", "questions": 20, "duration_minutes": 30, "note": "test"},
                          timeout=15)
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["subject"] == "Matematik" and rec["questions"] == 20
        pytest.rec_id = rec["id"]

        r2 = requests.get(f"{API}/study-records?filter=today", headers=h(student["token"]), timeout=15)
        assert r2.status_code == 200
        ids = [x["id"] for x in r2.json()["records"]]
        assert rec["id"] in ids

    def test_invalid_subject(self, student):
        r = requests.post(f"{API}/study-records", headers=h(student["token"]),
                          json={"subject": "Invalid", "questions": 5}, timeout=15)
        assert r.status_code == 400

    def test_update(self, student):
        rid = pytest.rec_id
        r = requests.put(f"{API}/study-records/{rid}", headers=h(student["token"]),
                         json={"subject": "Türkçe", "questions": 40}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["subject"] == "Türkçe"
        assert r.json()["questions"] == 40

    def test_filters(self, student):
        for f in ["today", "week", "month", "all"]:
            r = requests.get(f"{API}/study-records?filter={f}", headers=h(student["token"]), timeout=15)
            assert r.status_code == 200

    def test_delete(self, student):
        rid = pytest.rec_id
        r = requests.delete(f"{API}/study-records/{rid}", headers=h(student["token"]), timeout=15)
        assert r.status_code == 200
        r2 = requests.get(f"{API}/study-records?filter=all", headers=h(student["token"]), timeout=15)
        ids = [x["id"] for x in r2.json()["records"]]
        assert rid not in ids


# ---------------- Stats ----------------
class TestStats:
    def test_stats_shape(self, student):
        # add a record
        requests.post(f"{API}/study-records", headers=h(student["token"]),
                      json={"subject": "Fen Bilimleri", "questions": 15}, timeout=15)
        r = requests.get(f"{API}/stats", headers=h(student["token"]), timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_questions", "total_minutes", "days_studied", "subject_distribution", "daily"):
            assert k in d
        assert isinstance(d["daily"], list) and len(d["daily"]) == 7


# ---------------- Connection & Coach flow ----------------
class TestConnectionAndCoach:
    def test_coach_request_and_accept(self, student, coach):
        code = student["user"]["student_code"]
        r = requests.post(f"{API}/connections/request", headers=h(coach["token"]),
                          json={"student_code": code}, timeout=15)
        assert r.status_code == 200, r.text
        conn = r.json()
        pytest.conn_id = conn["id"]

        # duplicate request from same coach
        r_dup = requests.post(f"{API}/connections/request", headers=h(coach["token"]),
                              json={"student_code": code}, timeout=15)
        assert r_dup.status_code == 400

        # student sees pending
        r2 = requests.get(f"{API}/connections/pending", headers=h(student["token"]), timeout=15)
        assert r2.status_code == 200
        assert any(c["id"] == conn["id"] for c in r2.json()["connections"])

        # accept
        r3 = requests.post(f"{API}/connections/{conn['id']}/accept", headers=h(student["token"]), timeout=15)
        assert r3.status_code == 200

        # coach sees student
        r4 = requests.get(f"{API}/coach/students", headers=h(coach["token"]), timeout=15)
        assert r4.status_code == 200
        assert any(s["user_id"] == student["user"]["user_id"] for s in r4.json()["students"])

    def test_coach_student_detail(self, student, coach):
        sid = student["user"]["user_id"]
        r = requests.get(f"{API}/coach/students/{sid}", headers=h(coach["token"]), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "stats" in d and "records" in d and "goals" in d

    def test_coach_set_goal_and_progress(self, student, coach):
        sid = student["user"]["user_id"]
        r = requests.post(f"{API}/coach/students/{sid}/goals", headers=h(coach["token"]),
                          json={"subject": "Matematik", "period": "weekly", "target": 100}, timeout=15)
        assert r.status_code == 200, r.text
        goal_id = r.json()["id"]
        pytest.goal_id = goal_id

        r2 = requests.get(f"{API}/goals", headers=h(student["token"]), timeout=15)
        assert r2.status_code == 200
        assert any(g["subject"] == "Matematik" and g["target"] == 100 for g in r2.json()["goals"])

    def test_goal_bad_subject(self, student, coach):
        sid = student["user"]["user_id"]
        r = requests.post(f"{API}/coach/students/{sid}/goals", headers=h(coach["token"]),
                          json={"subject": "Nope", "period": "weekly", "target": 10}, timeout=15)
        assert r.status_code == 400

    def test_delete_goal(self, coach):
        r = requests.delete(f"{API}/goals/{pytest.goal_id}", headers=h(coach["token"]), timeout=15)
        assert r.status_code == 200

    def test_coach_comment_and_student_read(self, student, coach):
        sid = student["user"]["user_id"]
        r = requests.post(f"{API}/coach/students/{sid}/comments", headers=h(coach["token"]),
                          json={"text": "Aferin!"}, timeout=15)
        assert r.status_code == 200, r.text

        r2 = requests.get(f"{API}/comments/unread-count", headers=h(student["token"]), timeout=15)
        assert r2.status_code == 200
        assert r2.json()["count"] >= 1

        r3 = requests.post(f"{API}/comments/read-all", headers=h(student["token"]), timeout=15)
        assert r3.status_code == 200

        r4 = requests.get(f"{API}/comments/unread-count", headers=h(student["token"]), timeout=15)
        assert r4.json()["count"] == 0


# ---------------- RBAC / Security ----------------
class TestRBAC:
    def test_student_cannot_access_coach(self, student):
        r = requests.get(f"{API}/coach/students", headers=h(student["token"]), timeout=15)
        assert r.status_code == 403

    def test_coach_cannot_access_student_endpoints(self, coach):
        r = requests.get(f"{API}/stats", headers=h(coach["token"]), timeout=15)
        assert r.status_code == 403

    def test_coach_cannot_view_unconnected_student(self, coach):
        # create second isolated student
        email = f"TEST_stu2_{_uid()}@test.com"
        r = requests.post(f"{API}/auth/register", json={
            "name": "Diğer", "email": email, "password": "123456",
            "role": "student", "grade": 7,
        }, timeout=15)
        assert r.status_code == 200
        sid = r.json()["user"]["user_id"]
        r2 = requests.get(f"{API}/coach/students/{sid}", headers=h(coach["token"]), timeout=15)
        assert r2.status_code == 403

    def test_no_token(self):
        r = requests.get(f"{API}/stats", timeout=15)
        assert r.status_code == 401


# ---------------- Profile ----------------
class TestProfile:
    def test_student_profile_shows_coach(self, student):
        r = requests.get(f"{API}/profile", headers=h(student["token"]), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["student_code"]
        assert d.get("coach") is not None
        assert "name" in d["coach"]

    def test_coach_profile_student_count(self, coach):
        r = requests.get(f"{API}/profile", headers=h(coach["token"]), timeout=15)
        assert r.status_code == 200
        assert r.json().get("student_count", 0) >= 1


# ---------------- Meta ----------------
def test_subjects():
    r = requests.get(f"{API}/subjects", timeout=15)
    assert r.status_code == 200
    assert "Matematik" in r.json()["subjects"]


def test_logout(student):
    r = requests.post(f"{API}/auth/logout", headers=h(student["token"]), timeout=15)
    assert r.status_code == 200
    r2 = requests.get(f"{API}/auth/me", headers=h(student["token"]), timeout=15)
    assert r2.status_code == 401


# ---------------- Password reset (forgot / reset) ----------------
@pytest.fixture(scope="module")
def reset_user():
    """Fresh @resend.dev student so forgot-password returns debug_code."""
    email = f"TEST_reset_{_uid()}@resend.dev"
    r = requests.post(f"{API}/auth/register", json={
        "name": "Reset User", "email": email, "password": "oldpass1",
        "role": "student", "grade": 7,
    }, timeout=30)
    assert r.status_code == 200, r.text
    return {"email": email, "token": r.json()["session_token"]}


class TestPasswordReset:
    def test_forgot_unknown_email_no_enumeration(self):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": f"nope_{_uid()}@resend.dev"}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d.get("ok") is True
        # unknown email must NOT return a debug_code
        assert "debug_code" not in d

    def test_forgot_known_resend_returns_debug_code(self, reset_user):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": reset_user["email"]}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert "debug_code" in d
        code = d["debug_code"]
        assert isinstance(code, str) and len(code) == 6 and code.isdigit()
        pytest.reset_code = code

    def test_reset_wrong_code_400(self, reset_user):
        r = requests.post(f"{API}/auth/reset-password", json={
            "email": reset_user["email"], "code": "000000", "new_password": "newpass1"
        }, timeout=15)
        # 1/1000 chance of collision with debug code – re-request if so
        if r.status_code != 400:
            # regenerate a fresh code and retry
            r2 = requests.post(f"{API}/auth/forgot-password",
                               json={"email": reset_user["email"]}, timeout=30)
            pytest.reset_code = r2.json()["debug_code"]
            r = requests.post(f"{API}/auth/reset-password", json={
                "email": reset_user["email"], "code": "000000", "new_password": "newpass1"
            }, timeout=15)
        assert r.status_code == 400
        assert "hatal" in r.json().get("detail", "").lower()

    def test_reset_short_password_400(self, reset_user):
        r = requests.post(f"{API}/auth/reset-password", json={
            "email": reset_user["email"], "code": pytest.reset_code, "new_password": "abc"
        }, timeout=15)
        assert r.status_code == 400

    def test_reset_success_and_login_swap(self, reset_user):
        # correct code -> reset works
        r = requests.post(f"{API}/auth/reset-password", json={
            "email": reset_user["email"], "code": pytest.reset_code, "new_password": "newpass1"
        }, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # old password no longer works
        r_old = requests.post(f"{API}/auth/login", json={
            "email": reset_user["email"], "password": "oldpass1"
        }, timeout=15)
        assert r_old.status_code == 401

        # new password works
        r_new = requests.post(f"{API}/auth/login", json={
            "email": reset_user["email"], "password": "newpass1"
        }, timeout=15)
        assert r_new.status_code == 200, r_new.text
        assert r_new.json()["user"]["email"] == reset_user["email"].lower()

        # previous session invalidated
        r_me = requests.get(f"{API}/auth/me", headers=h(reset_user["token"]), timeout=15)
        assert r_me.status_code == 401

    def test_reset_code_single_use(self, reset_user):
        # reusing the same code must fail
        r = requests.post(f"{API}/auth/reset-password", json={
            "email": reset_user["email"], "code": pytest.reset_code, "new_password": "newpass2"
        }, timeout=15)
        assert r.status_code == 400


# ---------------- Change password ----------------
@pytest.fixture(scope="module")
def cp_user():
    """Fresh student for change-password tests."""
    email = f"TEST_cp_{_uid()}@test.com"
    r = requests.post(f"{API}/auth/register", json={
        "name": "CP Öğrenci", "email": email, "password": "oldpass1",
        "role": "student", "grade": 8,
    }, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    return {"email": email, "token": d["session_token"], "user": d["user"], "password": "oldpass1"}


@pytest.fixture(scope="module")
def cp_coach():
    email = f"TEST_cpkoc_{_uid()}@test.com"
    r = requests.post(f"{API}/auth/register", json={
        "name": "CP Koç", "email": email, "password": "oldpass1", "role": "coach",
    }, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    return {"email": email, "token": d["session_token"], "password": "oldpass1"}


class TestChangePassword:
    # has_password / no leak checks (email account)
    def test_has_password_true_in_me_and_profile(self, cp_user):
        r_me = requests.get(f"{API}/auth/me", headers=h(cp_user["token"]), timeout=15)
        assert r_me.status_code == 200
        me = r_me.json()
        assert me["user"]["has_password"] is True
        assert "password" not in me["user"]

        r_p = requests.get(f"{API}/profile", headers=h(cp_user["token"]), timeout=15)
        assert r_p.status_code == 200
        prof = r_p.json()
        assert prof.get("has_password") is True
        assert "password" not in prof

    def test_change_password_no_token_401(self, cp_user):
        r = requests.post(f"{API}/auth/change-password", json={
            "current_password": cp_user["password"], "new_password": "newpass1"
        }, timeout=15)
        assert r.status_code == 401

    def test_change_password_bad_token_401(self, cp_user):
        r = requests.post(f"{API}/auth/change-password",
                          headers={"Authorization": "Bearer not-a-real-token"},
                          json={"current_password": cp_user["password"], "new_password": "newpass1"},
                          timeout=15)
        assert r.status_code == 401

    def test_change_password_wrong_current_400(self, cp_user):
        r = requests.post(f"{API}/auth/change-password",
                          headers=h(cp_user["token"]),
                          json={"current_password": "wrongpass", "new_password": "newpass1"},
                          timeout=15)
        assert r.status_code == 400
        assert "Mevcut şifre yanlış" in r.json().get("detail", "")

    def test_change_password_same_as_current_400(self, cp_user):
        r = requests.post(f"{API}/auth/change-password",
                          headers=h(cp_user["token"]),
                          json={"current_password": cp_user["password"],
                                "new_password": cp_user["password"]},
                          timeout=15)
        assert r.status_code == 400

    def test_change_password_too_short_400(self, cp_user):
        r = requests.post(f"{API}/auth/change-password",
                          headers=h(cp_user["token"]),
                          json={"current_password": cp_user["password"], "new_password": "abc"},
                          timeout=15)
        assert r.status_code == 400

    def test_change_password_success_keeps_current_revokes_others(self, cp_user):
        # Login a SECOND time to get another session for the same user.
        r_login2 = requests.post(f"{API}/auth/login", json={
            "email": cp_user["email"], "password": cp_user["password"]
        }, timeout=15)
        assert r_login2.status_code == 200
        other_token = r_login2.json()["session_token"]
        # Sanity: both tokens work before change
        assert requests.get(f"{API}/auth/me", headers=h(cp_user["token"]), timeout=15).status_code == 200
        assert requests.get(f"{API}/auth/me", headers=h(other_token), timeout=15).status_code == 200

        # Change password using cp_user["token"] (current session must survive)
        new_password = "newpass1"
        r = requests.post(f"{API}/auth/change-password",
                          headers=h(cp_user["token"]),
                          json={"current_password": cp_user["password"], "new_password": new_password},
                          timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # Current session still valid
        r_me = requests.get(f"{API}/auth/me", headers=h(cp_user["token"]), timeout=15)
        assert r_me.status_code == 200
        # The OTHER session must be revoked
        r_other = requests.get(f"{API}/auth/me", headers=h(other_token), timeout=15)
        assert r_other.status_code == 401

        # persist new password for downstream tests
        cp_user["password"] = new_password

    def test_login_with_old_password_fails(self, cp_user):
        r = requests.post(f"{API}/auth/login", json={
            "email": cp_user["email"], "password": "oldpass1"
        }, timeout=15)
        assert r.status_code == 401

    def test_login_with_new_password_works(self, cp_user):
        r = requests.post(f"{API}/auth/login", json={
            "email": cp_user["email"], "password": cp_user["password"]
        }, timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == cp_user["email"].lower()
        assert r.json()["user"]["has_password"] is True
        assert "password" not in r.json()["user"]

    def test_change_password_works_for_coach(self, cp_coach):
        r = requests.post(f"{API}/auth/change-password",
                          headers=h(cp_coach["token"]),
                          json={"current_password": cp_coach["password"], "new_password": "newkoc1"},
                          timeout=15)
        assert r.status_code == 200, r.text
        # login with new
        r_new = requests.post(f"{API}/auth/login", json={
            "email": cp_coach["email"], "password": "newkoc1"
        }, timeout=15)
        assert r_new.status_code == 200
        assert r_new.json()["user"]["role"] == "coach"
