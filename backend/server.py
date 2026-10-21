from fastapi import FastAPI, APIRouter, Depends, HTTPException, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import random
import string
import secrets
import re
import ipaddress
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, BeforeValidator
from typing import List, Optional, Annotated, Literal
from datetime import datetime, timezone, timedelta, date
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# MongoDB connection
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

# --- Emergent managed email (Resend) ---
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ["EMERGENT_EMAIL_KEY"]
EMAIL_FROM_NAME = os.environ["EMAIL_FROM_NAME"]

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> str | None:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    try:
        async with httpx.AsyncClient(timeout=30) as http:
            resp = await http.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail="E-posta gönderilemedi")
    except Exception as e:
        logger.error(f"Email send error: {str(e)}")
        raise HTTPException(status_code=500, detail="E-posta gönderilemedi")


def reset_code_email_html(name: str, code: str) -> str:
    safe_name = escape(name or "")
    safe_code = escape(code)
    return (
        '<table role="presentation" width="100%" style="background:#F8FAFC;padding:24px">'
        '<tr><td align="center">'
        '<table role="presentation" width="100%" style="max-width:480px;background:#FFFFFF;'
        'border-radius:16px;padding:28px;font-family:Arial,sans-serif">'
        f'<tr><td style="font-size:20px;font-weight:bold;color:#0F172A">ŞHA LGS Koçu</td></tr>'
        f'<tr><td style="padding-top:12px;font-size:15px;color:#1E293B">Merhaba {safe_name},</td></tr>'
        '<tr><td style="padding-top:8px;font-size:15px;color:#334155">'
        'Şifre sıfırlama isteğin için doğrulama kodun aşağıda. Bu kodu uygulamadaki '
        '&quot;Şifremi Unuttum&quot; ekranına gir.</td></tr>'
        f'<tr><td align="center" style="padding:20px 0"><span style="display:inline-block;'
        'background:#DBEAFE;color:#1E3A8A;font-size:32px;font-weight:bold;letter-spacing:8px;'
        f'padding:14px 24px;border-radius:12px">{safe_code}</span></td></tr>'
        '<tr><td style="font-size:13px;color:#64748B">Bu kod 15 dakika geçerlidir. '
        'İsteği sen yapmadıysan bu e-postayı yok sayabilirsin.</td></tr>'
        '<tr><td style="padding-top:16px;font-size:12px;color:#94A3B8">'
        'Bu e-posta ŞHA LGS Koçu tarafından gönderildi. Şifreni veya kodunu asla '
        'e-posta ile geri istemiyoruz.</td></tr>'
        '</table></td></tr></table>'
    )


SUBJECTS = [
    "Matematik",
    "Türkçe",
    "Fen Bilimleri",
    "T.C. İnkılap Tarihi",
    "Din Kültürü",
    "İngilizce",
    "Kitap",
    "Deneme",
    "Diğer",
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def gen_user_id() -> str:
    return f"user_{uuid.uuid4().hex[:12]}"


def gen_student_code() -> str:
    return "OGR-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


def gen_token() -> str:
    return uuid.uuid4().hex + uuid.uuid4().hex


def today_str() -> str:
    return now_utc().date().isoformat()


def week_start_date() -> date:
    d = now_utc().date()
    return d - timedelta(days=d.weekday())  # Monday


def month_start_date() -> date:
    d = now_utc().date()
    return d.replace(day=1)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Literal["student", "coach", "parent"]
    grade: Optional[int] = None  # 7 or 8, students only


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class SessionInput(BaseModel):
    session_id: str


class ForgotPasswordInput(BaseModel):
    email: EmailStr


class ResetPasswordInput(BaseModel):
    email: EmailStr
    code: str
    new_password: str


class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str


class CompleteProfileInput(BaseModel):
    role: Literal["student", "coach"]
    grade: Optional[int] = None


class StudyRecordInput(BaseModel):
    subject: str
    questions: int = 0
    duration_minutes: Optional[int] = None
    note: Optional[str] = None
    study_date: Optional[str] = None  # YYYY-MM-DD (device local)


class GoalInput(BaseModel):
    subject: str
    period: Literal["daily", "weekly"]
    target: int


class CommentInput(BaseModel):
    text: str


class ConnectionRequestInput(BaseModel):
    student_code: str


class ParentConnectInput(BaseModel):
    student_code: str


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------

async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Yetkilendirme gerekli")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Geçersiz oturum")
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < now_utc():
        raise HTTPException(status_code=401, detail="Oturum süresi doldu")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
    return user


def public_user(user: dict) -> dict:
    return {
        "user_id": user["user_id"],
        "name": user.get("name"),
        "email": user.get("email"),
        "role": user.get("role"),
        "grade": user.get("grade"),
        "student_code": user.get("student_code"),
        "picture": user.get("picture"),
        "has_password": bool(user.get("password")),
    }


async def create_session(user_id: str) -> str:
    token = gen_token()
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "created_at": iso(now_utc()),
        "expires_at": iso(now_utc() + timedelta(days=365)),
    })
    return token


async def require_student(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Sadece öğrenciler erişebilir")
    return user


async def require_coach(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "coach":
        raise HTTPException(status_code=403, detail="Sadece koçlar erişebilir")
    return user


async def require_parent(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "parent":
        raise HTTPException(status_code=403, detail="Sadece veliler erişebilir")
    return user


async def assert_parent_linked(parent_id: str, student_id: str):
    conn = await db.parent_student_connections.find_one(
        {"parent_id": parent_id, "student_id": student_id, "status": "accepted"}, {"_id": 0}
    )
    if not conn:
        raise HTTPException(status_code=403, detail="Bu öğrenciye erişiminiz yok")


async def get_connected_coach_id(student_id: str) -> Optional[str]:
    conn = await db.coach_student_connections.find_one(
        {"student_id": student_id, "status": "accepted"}, {"_id": 0}
    )
    return conn["coach_id"] if conn else None


async def assert_coach_owns_student(coach_id: str, student_id: str):
    conn = await db.coach_student_connections.find_one(
        {"coach_id": coach_id, "student_id": student_id, "status": "accepted"}, {"_id": 0}
    )
    if not conn:
        raise HTTPException(status_code=403, detail="Bu öğrenciye erişiminiz yok")


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

@api_router.get("/")
async def root():
    return {"message": "ŞHA LGS Koçu API"}


@api_router.post("/auth/register")
async def register(data: RegisterInput):
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Bu e-posta zaten kayıtlı")
    if data.role == "student" and data.grade not in (7, 8):
        raise HTTPException(status_code=400, detail="Sınıf 7 veya 8 olmalı")
    user_id = gen_user_id()
    user = {
        "user_id": user_id,
        "name": data.name.strip(),
        "email": data.email.lower(),
        "password": hash_password(data.password),
        "role": data.role,
        "grade": data.grade if data.role == "student" else None,
        "student_code": gen_student_code() if data.role == "student" else None,
        "picture": None,
        "auth_provider": "email",
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(user)
    token = await create_session(user_id)
    return {"session_token": token, "user": public_user(user)}


@api_router.post("/auth/login")
async def login(data: LoginInput):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not user.get("password") or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı")
    token = await create_session(user["user_id"])
    return {"session_token": token, "user": public_user(user)}


@api_router.post("/auth/forgot-password")
async def forgot_password(data: ForgotPasswordInput):
    email = data.email.lower()
    generic = {"ok": True, "message": "Eğer bu e-posta kayıtlıysa sıfırlama kodu gönderildi."}
    user = await db.users.find_one({"email": email})
    # Only email/password accounts can reset a password.
    if not user or not user.get("password"):
        return generic
    code = f"{random.randint(0, 999999):06d}"
    # invalidate previous unused codes for this email
    await db.password_resets.update_many(
        {"email": email, "used": False}, {"$set": {"used": True}}
    )
    await db.password_resets.insert_one({
        "email": email,
        "code_hash": hash_password(code),
        "expires_at": iso(now_utc() + timedelta(minutes=15)),
        "used": False,
        "attempts": 0,
        "created_at": iso(now_utc()),
    })
    subject = "ŞHA LGS Koçu — Şifre Sıfırlama Kodun"
    html = reset_code_email_html(user.get("name") or "", code)
    try:
        await send_email(to=email, subject=subject, html=html)
    except HTTPException:
        # Surface a real send failure so the user retries instead of waiting
        # forever for a mail that never left.
        raise HTTPException(
            status_code=502,
            detail="Şu anda e-posta gönderemedik. Lütfen birkaç dakika sonra tekrar dene.",
        )
    # Test-only convenience: Resend's test domain lets automated tests read the code.
    if email.endswith("@resend.dev"):
        return {**generic, "debug_code": code}
    return generic


@api_router.post("/auth/reset-password")
async def reset_password(data: ResetPasswordInput):
    email = data.email.lower()
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Şifre en az 6 karakter olmalı")
    reset = await db.password_resets.find_one(
        {"email": email, "used": False}, {"_id": 0}, sort=[("created_at", -1)]
    )
    if not reset:
        raise HTTPException(status_code=400, detail="Geçerli bir sıfırlama isteği bulunamadı")
    expires_at = reset["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now_utc():
        raise HTTPException(status_code=400, detail="Kodun süresi doldu. Yeni kod iste.")
    if reset.get("attempts", 0) >= 5:
        raise HTTPException(status_code=400, detail="Çok fazla deneme. Yeni kod iste.")
    if not verify_password(data.code.strip(), reset["code_hash"]):
        await db.password_resets.update_one(
            {"email": email, "used": False, "created_at": reset["created_at"]},
            {"$inc": {"attempts": 1}},
        )
        raise HTTPException(status_code=400, detail="Kod hatalı")

    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=400, detail="Kullanıcı bulunamadı")
    await db.users.update_one(
        {"user_id": user["user_id"]}, {"$set": {"password": hash_password(data.new_password)}}
    )
    await db.password_resets.update_one(
        {"email": email, "used": False, "created_at": reset["created_at"]},
        {"$set": {"used": True}},
    )
    # Invalidate all existing sessions for safety; user logs in with new password.
    await db.user_sessions.delete_many({"user_id": user["user_id"]})
    return {"ok": True, "message": "Şifren güncellendi. Yeni şifrenle giriş yapabilirsin."}


@api_router.post("/auth/session")
async def google_session(data: SessionInput):
    async with httpx.AsyncClient(timeout=20) as http:
        resp = await http.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": data.session_id})
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Google oturumu doğrulanamadı")
    payload = resp.json()
    email = (payload.get("email") or "").lower()
    name = payload.get("name")
    picture = payload.get("picture")
    if not email:
        raise HTTPException(status_code=401, detail="E-posta alınamadı")

    user = await db.users.find_one({"email": email})
    if not user:
        user_id = gen_user_id()
        user = {
            "user_id": user_id,
            "name": name,
            "email": email,
            "password": None,
            "role": None,  # picked in complete-profile
            "grade": None,
            "student_code": None,
            "picture": picture,
            "auth_provider": "google",
            "created_at": iso(now_utc()),
        }
        await db.users.insert_one(user)
    else:
        if picture and not user.get("picture"):
            await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"picture": picture}})
            user["picture"] = picture

    token = await create_session(user["user_id"])
    return {"session_token": token, "user": public_user(user)}


@api_router.post("/auth/complete-profile")
async def complete_profile(data: CompleteProfileInput, user: dict = Depends(get_current_user)):
    if user.get("role"):
        raise HTTPException(status_code=400, detail="Profil zaten tamamlanmış")
    if data.role == "student" and data.grade not in (7, 8):
        raise HTTPException(status_code=400, detail="Sınıf 7 veya 8 olmalı")
    update = {
        "role": data.role,
        "grade": data.grade if data.role == "student" else None,
        "student_code": gen_student_code() if data.role == "student" else None,
    }
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
    user.update(update)
    return {"user": public_user(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": public_user(user)}


@api_router.post("/auth/change-password")
async def change_password(
    data: ChangePasswordInput,
    authorization: Optional[str] = Header(None),
    user: dict = Depends(get_current_user),
):
    full = await db.users.find_one({"user_id": user["user_id"]})
    if not full or not full.get("password"):
        raise HTTPException(status_code=409, detail="Bu hesap e-posta/şifre girişi kullanmıyor")
    if not verify_password(data.current_password, full["password"]):
        raise HTTPException(status_code=400, detail="Mevcut şifre yanlış")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Yeni şifre en az 6 karakter olmalı")
    if verify_password(data.new_password, full["password"]):
        raise HTTPException(status_code=400, detail="Yeni şifre mevcut şifreyle aynı olamaz")
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"password": hash_password(data.new_password), "password_changed_at": iso(now_utc())}},
    )
    # Keep the current session, revoke the rest.
    current_token = ""
    if authorization and authorization.startswith("Bearer "):
        current_token = authorization.split(" ", 1)[1].strip()
    await db.user_sessions.delete_many(
        {"user_id": user["user_id"], "session_token": {"$ne": current_token}}
    )
    return {"ok": True, "message": "Şifren güncellendi"}


@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Study records (student)
# ---------------------------------------------------------------------------

@api_router.post("/study-records")
async def create_study_record(data: StudyRecordInput, user: dict = Depends(require_student)):
    if data.subject not in SUBJECTS:
        raise HTTPException(status_code=400, detail="Geçersiz ders")
    rec_id = str(uuid.uuid4())
    study_date = data.study_date or today_str()
    record = {
        "id": rec_id,
        "user_id": user["user_id"],
        "subject": data.subject,
        "questions": max(0, data.questions or 0),
        "duration_minutes": data.duration_minutes,
        "note": (data.note or "").strip() or None,
        "study_date": study_date,
        "created_at": iso(now_utc()),
        "deleted_at": None,
    }
    await db.study_records.insert_one(record)
    record.pop("_id", None)
    return record


def _filter_range(filter_key: str):
    if filter_key == "today":
        return today_str(), today_str()
    if filter_key == "week":
        return week_start_date().isoformat(), today_str()
    if filter_key == "month":
        return month_start_date().isoformat(), today_str()
    return None, None


@api_router.get("/study-records")
async def list_study_records(filter: str = "all", user: dict = Depends(require_student)):
    query = {"user_id": user["user_id"], "deleted_at": None}
    start, end = _filter_range(filter)
    if start:
        query["study_date"] = {"$gte": start, "$lte": end}
    records = await db.study_records.find(query, {"_id": 0}).sort("study_date", -1).to_list(2000)
    records.sort(key=lambda r: (r["study_date"], r["created_at"]), reverse=True)
    return {"records": records}


@api_router.put("/study-records/{record_id}")
async def update_study_record(record_id: str, data: StudyRecordInput, user: dict = Depends(require_student)):
    rec = await db.study_records.find_one({"id": record_id, "user_id": user["user_id"], "deleted_at": None})
    if not rec:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    if data.subject not in SUBJECTS:
        raise HTTPException(status_code=400, detail="Geçersiz ders")
    update = {
        "subject": data.subject,
        "questions": max(0, data.questions or 0),
        "duration_minutes": data.duration_minutes,
        "note": (data.note or "").strip() or None,
    }
    if data.study_date:
        update["study_date"] = data.study_date
    await db.study_records.update_one({"id": record_id}, {"$set": update})
    updated = await db.study_records.find_one({"id": record_id}, {"_id": 0})
    return updated


@api_router.delete("/study-records/{record_id}")
async def delete_study_record(record_id: str, user: dict = Depends(require_student)):
    rec = await db.study_records.find_one({"id": record_id, "user_id": user["user_id"], "deleted_at": None})
    if not rec:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    await db.study_records.update_one({"id": record_id}, {"$set": {"deleted_at": iso(now_utc())}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

async def compute_stats(user_id: str) -> dict:
    week_start = week_start_date().isoformat()
    records = await db.study_records.find(
        {"user_id": user_id, "deleted_at": None, "study_date": {"$gte": week_start}},
        {"_id": 0},
    ).to_list(5000)
    total_questions = sum(r.get("questions", 0) for r in records)
    total_minutes = sum(r.get("duration_minutes") or 0 for r in records)
    days = sorted({r["study_date"] for r in records})
    days_studied = len(days)

    # per subject
    by_subject: dict = {}
    for r in records:
        by_subject[r["subject"]] = by_subject.get(r["subject"], 0) + r.get("questions", 0)
    subject_distribution = [{"subject": k, "questions": v} for k, v in by_subject.items() if v > 0]
    subject_distribution.sort(key=lambda x: x["questions"], reverse=True)

    # daily bars for the week (Mon..Sun)
    ws = week_start_date()
    labels_tr = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]
    daily = []
    for i in range(7):
        d = (ws + timedelta(days=i)).isoformat()
        q = sum(r.get("questions", 0) for r in records if r["study_date"] == d)
        daily.append({"label": labels_tr[i], "date": d, "questions": q})

    return {
        "total_questions": total_questions,
        "total_minutes": total_minutes,
        "days_studied": days_studied,
        "subject_distribution": subject_distribution,
        "daily": daily,
    }


@api_router.get("/stats")
async def stats(user: dict = Depends(require_student)):
    return await compute_stats(user["user_id"])


# ---------------------------------------------------------------------------
# Goals
# ---------------------------------------------------------------------------

async def goals_with_progress(student_id: str) -> list:
    goals = await db.goals.find({"student_id": student_id, "deleted_at": None}, {"_id": 0}).to_list(200)
    result = []
    for g in goals:
        if g["period"] == "daily":
            recs = await db.study_records.find(
                {"user_id": student_id, "deleted_at": None, "subject": g["subject"], "study_date": today_str()},
                {"_id": 0},
            ).to_list(2000)
        else:
            recs = await db.study_records.find(
                {"user_id": student_id, "deleted_at": None, "subject": g["subject"],
                 "study_date": {"$gte": week_start_date().isoformat()}},
                {"_id": 0},
            ).to_list(2000)
        current = sum(r.get("questions", 0) for r in recs)
        result.append({
            "id": g["id"],
            "subject": g["subject"],
            "period": g["period"],
            "target": g["target"],
            "current": current,
            "completed": current >= g["target"],
            "has_coach": bool(g.get("coach_id")),
            "student_completed": bool(g.get("student_completed")),
        })
    return result


@api_router.get("/goals")
async def get_my_goals(user: dict = Depends(require_student)):
    return {"goals": await goals_with_progress(user["user_id"])}


@api_router.post("/goals/{goal_id}/complete")
async def mark_goal_completed(goal_id: str, user: dict = Depends(require_student)):
    goal = await db.goals.find_one(
        {"id": goal_id, "student_id": user["user_id"], "deleted_at": None}, {"_id": 0}
    )
    if not goal:
        raise HTTPException(status_code=404, detail="Hedef bulunamadı")
    coach_id = goal.get("coach_id")
    if coach_id:
        await db.goals.update_one({"id": goal_id}, {"$set": {"student_completed": True}})
        await db.coach_notifications.insert_one({
            "id": str(uuid.uuid4()),
            "coach_id": coach_id,
            "student_id": user["user_id"],
            "student_name": user.get("name"),
            "subject": goal["subject"],
            "read": False,
            "created_at": iso(now_utc()),
        })
    return {"ok": True}


# ---------------------------------------------------------------------------
# Coach notifications (in-app bell)
# ---------------------------------------------------------------------------

@api_router.get("/coach/notifications")
async def coach_notifications(user: dict = Depends(require_coach)):
    items = await db.coach_notifications.find(
        {"coach_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return {"notifications": items}


@api_router.get("/coach/notifications/unread-count")
async def coach_notifications_unread_count(user: dict = Depends(require_coach)):
    count = await db.coach_notifications.count_documents(
        {"coach_id": user["user_id"], "read": False}
    )
    return {"count": count}


@api_router.post("/coach/notifications/{notification_id}/read")
async def coach_notification_read(notification_id: str, user: dict = Depends(require_coach)):
    await db.coach_notifications.update_one(
        {"id": notification_id, "coach_id": user["user_id"]}, {"$set": {"read": True}}
    )
    return {"ok": True}


@api_router.post("/coach/notifications/read-all")
async def coach_notifications_read_all(user: dict = Depends(require_coach)):
    await db.coach_notifications.update_many(
        {"coach_id": user["user_id"], "read": False}, {"$set": {"read": True}}
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Comments (student view)
# ---------------------------------------------------------------------------

@api_router.get("/comments")
async def get_my_comments(user: dict = Depends(require_student)):
    comments = await db.comments.find({"student_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"comments": comments}


@api_router.post("/comments/{comment_id}/read")
async def mark_comment_read(comment_id: str, user: dict = Depends(require_student)):
    await db.comments.update_one(
        {"id": comment_id, "student_id": user["user_id"]}, {"$set": {"read": True}}
    )
    return {"ok": True}


@api_router.post("/comments/read-all")
async def mark_all_read(user: dict = Depends(require_student)):
    await db.comments.update_many(
        {"student_id": user["user_id"], "read": False}, {"$set": {"read": True}}
    )
    return {"ok": True}


@api_router.get("/comments/unread-count")
async def unread_count(user: dict = Depends(require_student)):
    count = await db.comments.count_documents({"student_id": user["user_id"], "read": False})
    return {"count": count}


# ---------------------------------------------------------------------------
# Connections
# ---------------------------------------------------------------------------

@api_router.post("/connections/request")
async def request_connection(data: ConnectionRequestInput, user: dict = Depends(require_coach)):
    code = data.student_code.strip().upper()
    student = await db.users.find_one({"student_code": code, "role": "student"})
    if not student:
        raise HTTPException(status_code=404, detail="Bu koda sahip öğrenci bulunamadı")
    student_id = student["user_id"]
    existing = await db.coach_student_connections.find_one(
        {"student_id": student_id, "status": {"$in": ["pending", "accepted"]}}, {"_id": 0}
    )
    if existing:
        if existing["coach_id"] == user["user_id"]:
            raise HTTPException(status_code=400, detail="Bu öğrenciye zaten istek gönderdiniz")
        raise HTTPException(status_code=400, detail="Öğrencinin başka bir koç bağlantısı mevcut")
    conn = {
        "id": str(uuid.uuid4()),
        "coach_id": user["user_id"],
        "coach_name": user.get("name"),
        "student_id": student_id,
        "student_name": student.get("name"),
        "status": "pending",
        "created_at": iso(now_utc()),
    }
    await db.coach_student_connections.insert_one(conn)
    conn.pop("_id", None)
    return conn


@api_router.get("/connections/pending")
async def pending_connections(user: dict = Depends(require_student)):
    conns = await db.coach_student_connections.find(
        {"student_id": user["user_id"], "status": "pending"}, {"_id": 0}
    ).to_list(50)
    return {"connections": conns}


@api_router.post("/connections/{conn_id}/accept")
async def accept_connection(conn_id: str, user: dict = Depends(require_student)):
    conn = await db.coach_student_connections.find_one(
        {"id": conn_id, "student_id": user["user_id"], "status": "pending"}, {"_id": 0}
    )
    if not conn:
        raise HTTPException(status_code=404, detail="İstek bulunamadı")
    # reject any other pending, ensure single coach
    await db.coach_student_connections.update_one({"id": conn_id}, {"$set": {"status": "accepted", "accepted_at": iso(now_utc())}})
    await db.coach_student_connections.update_many(
        {"student_id": user["user_id"], "status": "pending", "id": {"$ne": conn_id}},
        {"$set": {"status": "rejected"}},
    )
    return {"ok": True}


@api_router.post("/connections/{conn_id}/reject")
async def reject_connection(conn_id: str, user: dict = Depends(require_student)):
    await db.coach_student_connections.update_one(
        {"id": conn_id, "student_id": user["user_id"], "status": "pending"},
        {"$set": {"status": "rejected"}},
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------

@api_router.get("/profile")
async def profile(user: dict = Depends(get_current_user)):
    data = public_user(user)
    if user["role"] == "student":
        coach_id = await get_connected_coach_id(user["user_id"])
        coach = None
        if coach_id:
            c = await db.users.find_one({"user_id": coach_id}, {"_id": 0})
            if c:
                coach = {"name": c.get("name"), "email": c.get("email")}
        data["coach"] = coach
    elif user["role"] == "parent":
        count = await db.parent_student_connections.count_documents(
            {"parent_id": user["user_id"], "status": "accepted"}
        )
        data["children_count"] = count
    else:
        count = await db.coach_student_connections.count_documents(
            {"coach_id": user["user_id"], "status": "accepted"}
        )
        data["student_count"] = count
    return data


# ---------------------------------------------------------------------------
# Coach panel
# ---------------------------------------------------------------------------

async def student_week_summary(student_id: str) -> dict:
    week_start = week_start_date().isoformat()
    records = await db.study_records.find(
        {"user_id": student_id, "deleted_at": None, "study_date": {"$gte": week_start}},
        {"_id": 0},
    ).to_list(5000)
    total_questions = sum(r.get("questions", 0) for r in records)
    days = {r["study_date"] for r in records}
    last = await db.study_records.find(
        {"user_id": student_id, "deleted_at": None}, {"_id": 0}
    ).sort("study_date", -1).to_list(1)
    last_study = last[0]["study_date"] if last else None
    return {
        "week_questions": total_questions,
        "days_studied": len(days),
        "last_study": last_study,
    }


@api_router.get("/coach/students")
async def coach_students(user: dict = Depends(require_coach)):
    conns = await db.coach_student_connections.find(
        {"coach_id": user["user_id"], "status": "accepted"}, {"_id": 0}
    ).to_list(500)
    students = []
    for c in conns:
        s = await db.users.find_one({"user_id": c["student_id"]}, {"_id": 0, "password": 0})
        if not s:
            continue
        summary = await student_week_summary(s["user_id"])
        students.append({
            "user_id": s["user_id"],
            "name": s.get("name"),
            "grade": s.get("grade"),
            **summary,
        })
    students.sort(key=lambda x: x["name"] or "")
    return {"students": students}


@api_router.get("/coach/students/{student_id}")
async def coach_student_detail(student_id: str, user: dict = Depends(require_coach)):
    await assert_coach_owns_student(user["user_id"], student_id)
    s = await db.users.find_one({"user_id": student_id}, {"_id": 0, "password": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Öğrenci bulunamadı")
    stats_data = await compute_stats(student_id)
    records = await db.study_records.find(
        {"user_id": student_id, "deleted_at": None}, {"_id": 0}
    ).to_list(2000)
    records.sort(key=lambda r: (r["study_date"], r["created_at"]), reverse=True)
    goals = await goals_with_progress(student_id)
    return {
        "student": {"user_id": s["user_id"], "name": s.get("name"), "grade": s.get("grade"), "email": s.get("email")},
        "stats": stats_data,
        "records": records[:200],
        "goals": goals,
    }


@api_router.delete("/coach/students/{student_id}")
async def coach_remove_student(student_id: str, user: dict = Depends(require_coach)):
    await assert_coach_owns_student(user["user_id"], student_id)
    await db.coach_student_connections.update_many(
        {"coach_id": user["user_id"], "student_id": student_id, "status": "accepted"},
        {"$set": {"status": "removed", "removed_at": iso(now_utc())}},
    )
    return {"ok": True}


@api_router.get("/coach/students/{student_id}/goals")
async def coach_get_goals(student_id: str, user: dict = Depends(require_coach)):
    await assert_coach_owns_student(user["user_id"], student_id)
    return {"goals": await goals_with_progress(student_id)}


@api_router.post("/coach/students/{student_id}/goals")
async def coach_set_goal(student_id: str, data: GoalInput, user: dict = Depends(require_coach)):
    await assert_coach_owns_student(user["user_id"], student_id)
    if data.subject not in SUBJECTS:
        raise HTTPException(status_code=400, detail="Geçersiz ders")
    if data.target <= 0:
        raise HTTPException(status_code=400, detail="Hedef 0'dan büyük olmalı")
    # upsert one goal per subject per student
    existing = await db.goals.find_one(
        {"student_id": student_id, "subject": data.subject, "deleted_at": None}, {"_id": 0}
    )
    if existing:
        await db.goals.update_one(
            {"id": existing["id"]},
            {"$set": {"period": data.period, "target": data.target, "coach_id": user["user_id"]}},
        )
        goal_id = existing["id"]
    else:
        goal_id = str(uuid.uuid4())
        await db.goals.insert_one({
            "id": goal_id,
            "student_id": student_id,
            "coach_id": user["user_id"],
            "subject": data.subject,
            "period": data.period,
            "target": data.target,
            "created_at": iso(now_utc()),
            "deleted_at": None,
        })
    return {"id": goal_id, "ok": True}


@api_router.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str, user: dict = Depends(require_coach)):
    goal = await db.goals.find_one({"id": goal_id, "coach_id": user["user_id"], "deleted_at": None}, {"_id": 0})
    if not goal:
        raise HTTPException(status_code=404, detail="Hedef bulunamadı")
    await db.goals.update_one({"id": goal_id}, {"$set": {"deleted_at": iso(now_utc())}})
    return {"ok": True}


@api_router.post("/coach/students/{student_id}/comments")
async def coach_write_comment(student_id: str, data: CommentInput, user: dict = Depends(require_coach)):
    await assert_coach_owns_student(user["user_id"], student_id)
    text = data.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Yorum boş olamaz")
    comment = {
        "id": str(uuid.uuid4()),
        "student_id": student_id,
        "coach_id": user["user_id"],
        "coach_name": user.get("name"),
        "text": text,
        "read": False,
        "created_at": iso(now_utc()),
    }
    await db.comments.insert_one(comment)
    comment.pop("_id", None)
    return comment


@api_router.get("/coach/students/{student_id}/comments")
async def coach_list_comments(student_id: str, user: dict = Depends(require_coach)):
    await assert_coach_owns_student(user["user_id"], student_id)
    comments = await db.comments.find({"student_id": student_id, "coach_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"comments": comments}


# ---------------------------------------------------------------------------
# Parent panel (read-only; separate from coach connection system)
# ---------------------------------------------------------------------------

@api_router.post("/parent/connect")
async def parent_connect(data: ParentConnectInput, user: dict = Depends(require_parent)):
    code = data.student_code.strip().upper()
    student = await db.users.find_one({"student_code": code, "role": "student"})
    if not student:
        raise HTTPException(status_code=404, detail="Bu koda sahip öğrenci bulunamadı")
    student_id = student["user_id"]
    existing = await db.parent_student_connections.find_one(
        {"parent_id": user["user_id"], "student_id": student_id}, {"_id": 0}
    )
    if existing and existing.get("status") == "accepted":
        raise HTTPException(status_code=400, detail="Bu öğrenciye zaten bağlısınız")
    if existing:
        await db.parent_student_connections.update_one(
            {"id": existing["id"]},
            {"$set": {"status": "accepted", "student_name": student.get("name")}},
        )
    else:
        await db.parent_student_connections.insert_one({
            "id": str(uuid.uuid4()),
            "parent_id": user["user_id"],
            "parent_name": user.get("name"),
            "student_id": student_id,
            "student_name": student.get("name"),
            "status": "accepted",
            "created_at": iso(now_utc()),
        })
    return {"ok": True, "student_name": student.get("name")}


@api_router.get("/parent/children")
async def parent_children(user: dict = Depends(require_parent)):
    conns = await db.parent_student_connections.find(
        {"parent_id": user["user_id"], "status": "accepted"}, {"_id": 0}
    ).to_list(500)
    children = []
    for c in conns:
        s = await db.users.find_one({"user_id": c["student_id"]}, {"_id": 0, "password": 0})
        if not s:
            continue
        summary = await student_week_summary(s["user_id"])
        children.append({
            "user_id": s["user_id"],
            "name": s.get("name"),
            "grade": s.get("grade"),
            **summary,
        })
    children.sort(key=lambda x: x["name"] or "")
    return {"children": children}


@api_router.get("/parent/children/{student_id}")
async def parent_child_detail(student_id: str, user: dict = Depends(require_parent)):
    await assert_parent_linked(user["user_id"], student_id)
    s = await db.users.find_one({"user_id": student_id}, {"_id": 0, "password": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Öğrenci bulunamadı")
    stats_data = await compute_stats(student_id)
    records = await db.study_records.find(
        {"user_id": student_id, "deleted_at": None}, {"_id": 0}
    ).to_list(2000)
    records.sort(key=lambda r: (r["study_date"], r["created_at"]), reverse=True)
    goals = await goals_with_progress(student_id)
    coach_id = await get_connected_coach_id(student_id)
    coach = None
    if coach_id:
        c = await db.users.find_one({"user_id": coach_id}, {"_id": 0})
        if c:
            coach = {"name": c.get("name")}
    return {
        "student": {"user_id": s["user_id"], "name": s.get("name"), "grade": s.get("grade")},
        "stats": stats_data,
        "records": records[:200],
        "goals": goals,
        "coach": coach,
    }


@api_router.get("/parent/children/{student_id}/comments")
async def parent_child_comments(student_id: str, user: dict = Depends(require_parent)):
    await assert_parent_linked(user["user_id"], student_id)
    comments = await db.comments.find(
        {"student_id": student_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return {"comments": comments}


@api_router.delete("/parent/children/{student_id}")
async def parent_unlink(student_id: str, user: dict = Depends(require_parent)):
    await db.parent_student_connections.update_many(
        {"parent_id": user["user_id"], "student_id": student_id},
        {"$set": {"status": "removed"}},
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Admin (Müdür) panel — fixed-credential, read-only stats. Additive; does not
# touch the existing student/coach/parent auth or data.
# ---------------------------------------------------------------------------

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "720587")


class AdminLoginInput(BaseModel):
    username: str
    password: str


async def require_admin(authorization: Optional[str] = Header(None)) -> bool:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Yetkisiz")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.admin_sessions.find_one({"token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Geçersiz oturum")
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < now_utc():
        raise HTTPException(status_code=401, detail="Oturum süresi doldu")
    return True


@api_router.post("/admin/login")
async def admin_login(data: AdminLoginInput):
    if data.username.strip() != ADMIN_USERNAME or data.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Kullanıcı adı veya şifre hatalı")
    token = gen_token()
    await db.admin_sessions.insert_one({
        "token": token,
        "created_at": iso(now_utc()),
        "expires_at": iso(now_utc() + timedelta(days=365)),
    })
    return {"token": token}


@api_router.get("/admin/stats")
async def admin_stats(_: bool = Depends(require_admin)):
    total_students = await db.users.count_documents({"role": "student"})

    # Coach-assigned goals only (coach_id set). Group by student and mark a
    # student as "not fulfilling" if ANY of their coach goals is incomplete.
    coach_goals = await db.goals.find(
        {"deleted_at": None, "coach_id": {"$ne": None}}, {"_id": 0}
    ).to_list(5000)

    students_with_goals: set = set()
    not_fulfilling: set = set()
    for g in coach_goals:
        sid = g.get("student_id")
        if not sid:
            continue
        students_with_goals.add(sid)
        if g["period"] == "daily":
            recs = await db.study_records.find(
                {"user_id": sid, "deleted_at": None, "subject": g["subject"],
                 "study_date": today_str()},
                {"_id": 0, "questions": 1},
            ).to_list(2000)
        else:
            recs = await db.study_records.find(
                {"user_id": sid, "deleted_at": None, "subject": g["subject"],
                 "study_date": {"$gte": week_start_date().isoformat()}},
                {"_id": 0, "questions": 1},
            ).to_list(2000)
        current = sum(r.get("questions", 0) for r in recs)
        if current < g["target"]:
            not_fulfilling.add(sid)

    students_with_goals_count = len(students_with_goals)
    not_fulfilling_count = len(not_fulfilling)
    ratio = round(not_fulfilling_count / students_with_goals_count * 100) if students_with_goals_count else 0

    return {
        "total_students": total_students,
        "students_with_goals": students_with_goals_count,
        "not_fulfilling_count": not_fulfilling_count,
        "not_fulfilling_ratio": ratio,
    }


@api_router.get("/admin/users")
async def admin_users(_: bool = Depends(require_admin)):
    users = await db.users.find(
        {}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1, "student_code": 1}
    ).sort("name", 1).to_list(5000)
    return {"users": users}


TEMP_PW_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"


@api_router.post("/admin/users/{user_id}/reset-password")
async def admin_reset_password(user_id: str, _: bool = Depends(require_admin)):
    temp = "".join(secrets.choice(TEMP_PW_ALPHABET) for _ in range(8))
    res = await db.users.update_one(
        {"user_id": user_id}, {"$set": {"password": hash_password(temp)}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    # Log the user out everywhere so only the new password works.
    await db.user_sessions.delete_many({"user_id": user_id})
    logger.info(f"Admin reset password for user {user_id}")
    return {"temporary_password": temp}


# ---------------------------------------------------------------------------
# Meta
# ---------------------------------------------------------------------------

@api_router.get("/subjects")
async def get_subjects():
    return {"subjects": SUBJECTS}


@app.get("/health")
async def health():
    try:
        await client.admin.command("ping")
        return {"status": "ok", "db": "connected"}
    except Exception as e:
        return {"status": "ok", "db": "error", "detail": f"{type(e).__name__}: {str(e)[:300]}"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        await create_indexes()
    except Exception as e:
        logger.error(f"MongoDB connection failed: {type(e).__name__}: {e}")


async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("student_code")
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.study_records.create_index("user_id")
    await db.coach_student_connections.create_index("student_id")
    await db.coach_student_connections.create_index("coach_id")
    await db.parent_student_connections.create_index("parent_id")
    await db.parent_student_connections.create_index("student_id")
    await db.password_resets.create_index("email")
    logger.info("ŞHA LGS Koçu backend started")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
