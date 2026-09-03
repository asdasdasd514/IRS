"""
Report Service (MongoDB IRS Database)
Handles report generation for trips directly into trip_reports (No report_jobs collection)
"""

import logging
import os
import asyncio
from typing import List, Optional, Dict
from datetime import datetime, timedelta, timezone
import uuid
import httpx

from app.core.database import get_database
from app.schemas import WaypointType

logger = logging.getLogger(__name__)

REPORT_API_URL = os.getenv("REPORT_API_URL", "http://localhost:8001/report")
REPORT_API_TIMEOUT = float(os.getenv("REPORT_API_TIMEOUT", "3600.0"))

# In-memory tracking for polling without needing a MongoDB collection
_memory_job_status: Dict[str, dict] = {}


def to_vietnam_time(dt) -> str:
    if not dt:
        return ""
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt)
        except Exception:
            return dt
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    vietnam_time = dt + timedelta(hours=7)
    return vietnam_time.strftime('%d/%m/%Y %H:%M')


def to_vietnam_date(dt) -> str:
    if not dt:
        return ""
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt)
        except Exception:
            return dt
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    vietnam_time = dt + timedelta(hours=7)
    return vietnam_time.strftime('%d/%m/%Y')


async def build_report_prompt(trip: dict, created_at: Optional[datetime] = None) -> str:
    waypoints = trip.get("waypoints", [])
    schools = [w for w in waypoints if w.get("type") == WaypointType.SCHOOL.value]
    schools_visited = [w for w in schools if w.get("is_visited")]
    schools_unvisited = [w for w in schools if not w.get("is_visited")]

    total_tickets = 0
    db = get_database()
    school_ids = [w["id"] for w in schools]
    if school_ids and db is not None:
        tickets_cursor = db.waypoint_tickets.find({"waypoint_id": {"$in": school_ids}})
        tickets = await tickets_cursor.to_list(length=1000)
        total_tickets = sum(t.get("tickets_collected", 0) for t in tickets)

    report_time = created_at or datetime.now(timezone.utc)

    prompt = f"""# Tạo Báo Cáo Chuyến Đi Tuyển Sinh

Vui lòng tạo một báo cáo chi tiết và chuyên nghiệp cho chuyến đi tuyển sinh sau đây. Báo cáo cần được viết bằng tiếng Việt, sử dụng định dạng Markdown và bao gồm các phần sau:

## Thông Tin Chuyến Đi
- **Tên chuyến đi**: {trip.get('name')}
- **Ngày lập báo cáo**: {to_vietnam_time(report_time)}
- **Trạng thái**: {trip.get('status')}
- **Ngày tạo chuyến đi**: {to_vietnam_time(trip.get('created_at'))}
- **Tổng số trường**: {len(schools)} trường
- **Trường đã đi**: {len(schools_visited)}/{len(schools)} trường
- **Tổng số phiếu thu được**: {total_tickets} phiếu

## Danh Sách Trường Học

### Các trường đã đến ({len(schools_visited)} trường)

"""

    if schools_visited:
        for idx, school in enumerate(schools_visited, 1):
            prompt += f"\n#### {idx}. {school.get('name')}\n"
            prompt += f"- **Địa chỉ**: {school.get('address') or 'Chưa có thông tin'}\n"
            prompt += f"- **Ngày đến**: {to_vietnam_time(school.get('visited_at'))}\n"
            
            if db is not None:
                tk_cursor = db.waypoint_tickets.find({"waypoint_id": school["id"]})
                s_tickets = await tk_cursor.to_list(length=100)
                st_count = sum(t.get("tickets_collected", 0) for t in s_tickets)
                prompt += f"- **Số phiếu thu được**: {st_count} phiếu\n"
                if s_tickets:
                    prompt += f"  - Chi tiết:\n"
                    for ticket in s_tickets:
                        prompt += f"    - Lần {ticket.get('visit_number')}: {ticket.get('tickets_collected')} phiếu ({to_vietnam_date(ticket.get('collection_date'))})\n"
                        if ticket.get('notes'):
                            prompt += f"      - Ghi chú: {ticket.get('notes')}\n"
            else:
                prompt += f"- **Số phiếu thu được**: 0 phiếu\n"

            if db is not None:
                detail = await db.waypoint_details.find_one({"waypoint_id": school["id"]})
                if detail:
                    if detail.get("principal_name") or detail.get("vice_principal_name"):
                        prompt += f"- **Ban giám hiệu**:\n"
                        if detail.get("principal_name"):
                            prompt += f"  - Hiệu trưởng: {detail.get('principal_name')}"
                            if detail.get("principal_phone"):
                                prompt += f" (SĐT: {detail.get('principal_phone')})"
                            prompt += "\n"
                        if detail.get("vice_principal_name"):
                            prompt += f"  - Phó hiệu trưởng: {detail.get('vice_principal_name')}"
                            if detail.get("vice_principal_phone"):
                                prompt += f" (SĐT: {detail.get('vice_principal_phone')})"
                            prompt += "\n"
                    if detail.get("our_contact_person"):
                        prompt += f"- **Người liên hệ (bên mình)**: {detail.get('our_contact_person')}"
                        if detail.get("our_contact_role"):
                            prompt += f" ({detail.get('our_contact_role')})"
                        prompt += "\n"
                    if detail.get("contact_process"):
                        prompt += f"- **Quá trình liên lạc**: {detail.get('contact_process')}\n"

            if db is not None:
                vl_cursor = db.waypoint_visit_logs.find({"waypoint_id": school["id"]}).sort("visit_date", -1)
                logs = await vl_cursor.to_list(length=3)
                if logs:
                    prompt += f"- **Lịch sử ghé thăm** ({len(logs)} lần):\n"
                    for log in logs:
                        prompt += f"  - {to_vietnam_date(log.get('visit_date'))}: {log.get('visit_content')[:100]}\n"

            if school.get("notes"):
                prompt += f"- **Ghi chú**: {school.get('notes')}\n"
    else:
        prompt += "\n*Chưa có trường nào được ghé thăm.*\n"

    prompt += f"\n### Các trường chưa đến ({len(schools_unvisited)} trường)\n\n"
    if schools_unvisited:
        for idx, school in enumerate(schools_unvisited, 1):
            prompt += f"{idx}. **{school.get('name')}**"
            if school.get("address"):
                prompt += f" - {school.get('address')}"
            prompt += "\n"
    else:
        prompt += "*Đã hoàn thành tất cả các trường.*\n"

    return prompt


async def call_report_api(prompt: str) -> str:
    try:
        job_id = await _start_external_report_job(prompt)
        report_content = await _poll_external_report_job(job_id)
        return report_content
    except Exception as e:
        logger.error(f"Error during report generation flow: {e}")
        return f"# Báo cáo chuyến đi tuyển sinh\n\nNội dung báo cáo tự động cho chuyến đi.\n\n{prompt[:500]}"


async def _start_external_report_job(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            REPORT_API_URL,
            json={"prompt": prompt, "model": "Qwen/Qwen3-4B-Instruct-2507", "async_mode": True},
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        data = response.json()
        return data.get("job_id", "DIRECT_RESULT_RECEIVED")


async def _poll_external_report_job(job_id: str) -> str:
    if job_id == "DIRECT_RESULT_RECEIVED":
        return "# Báo cáo đã được khởi tạo trực tiếp"

    start_time = asyncio.get_event_loop().time()
    status_url = f"{REPORT_API_URL}/jobs/{job_id}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            current_time = asyncio.get_event_loop().time()
            if current_time - start_time > REPORT_API_TIMEOUT:
                raise TimeoutError("Timeout waiting for report generation")

            try:
                response = await client.get(status_url)
                if response.status_code == 404:
                    await asyncio.sleep(2)
                    continue

                response.raise_for_status()
                data = response.json()
                status = data.get("status")

                if status == "completed":
                    return data.get("result", "")
                elif status == "failed":
                    error_msg = data.get("error", "Unknown error")
                    raise Exception(f"External job failed: {error_msg}")

                await asyncio.sleep(5)
            except httpx.RequestError as e:
                logger.warning(f"Network error polling status: {e}. Retrying...")
                await asyncio.sleep(5)


async def generate_trip_report(trip_id: str, created_at: Optional[datetime] = None) -> dict:
    from app.services.trip_service import trip_service
    trip = await trip_service.get_trip(trip_id)
    if not trip:
        raise ValueError(f"Không tìm thấy chuyến đi với ID: {trip_id}")

    prompt = await build_report_prompt(trip, created_at)
    report_content = await call_report_api(prompt)

    waypoints = trip.get("waypoints", [])
    schools = [w for w in waypoints if w.get("type") == WaypointType.SCHOOL.value]
    schools_visited = [w for w in schools if w.get("is_visited")]

    total_tickets = trip.get("total_tickets", 0)
    report_id = str(uuid.uuid4())
    now = created_at or datetime.now(timezone.utc)

    report_doc = {
        "id": report_id,
        "trip_id": trip_id,
        "campaign_id": trip.get("campaign_id"),
        "report_content": report_content,
        "total_schools": len(schools),
        "schools_visited": len(schools_visited),
        "total_tickets": total_tickets,
        "created_at": now
    }

    db = get_database()
    await db.trip_reports.insert_one(report_doc)
    return report_doc


async def get_trip_reports(trip_id: str) -> List[dict]:
    db = get_database()
    cursor = db.trip_reports.find({"trip_id": trip_id}).sort("created_at", -1)
    return await cursor.to_list(length=1000)


async def get_all_reports() -> List[dict]:
    db = get_database()
    cursor = db.trip_reports.find({}).sort("created_at", -1)
    reports = await cursor.to_list(length=1000)

    report_list = []
    for report in reports:
        trip = await db.admission_trips.find_one({"id": report["trip_id"]})
        report["trip_name"] = trip.get("name") if trip else "Unknown"
        report_list.append(report)

    return report_list


async def get_report_by_id(report_id: str) -> Optional[dict]:
    db = get_database()
    return await db.trip_reports.find_one({"id": report_id})


async def start_report_generation_job(trip_id: str, created_at: Optional[datetime] = None) -> dict:
    job_id = str(uuid.uuid4())
    now = created_at or datetime.now(timezone.utc)

    _memory_job_status[job_id] = {
        "id": job_id,
        "trip_id": trip_id,
        "status": "pending",
        "progress": 0,
        "result_report_id": None,
        "error_message": None,
        "created_at": now,
        "updated_at": now
    }
    return _memory_job_status[job_id]


async def process_report_job_background(job_id: str, trip_id: str):
    try:
        if job_id in _memory_job_status:
            _memory_job_status[job_id]["status"] = "processing"
            _memory_job_status[job_id]["progress"] = 25

        job = _memory_job_status.get(job_id, {})
        created_at = job.get("created_at")

        report = await generate_trip_report(trip_id, created_at=created_at)

        if job_id in _memory_job_status:
            _memory_job_status[job_id]["status"] = "completed"
            _memory_job_status[job_id]["progress"] = 100
            _memory_job_status[job_id]["result_report_id"] = report["id"]
            _memory_job_status[job_id]["updated_at"] = datetime.now(timezone.utc)
    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        if job_id in _memory_job_status:
            _memory_job_status[job_id]["status"] = "failed"
            _memory_job_status[job_id]["error_message"] = str(e)
            _memory_job_status[job_id]["updated_at"] = datetime.now(timezone.utc)


async def get_report_job_status(job_id: str) -> Optional[dict]:
    # Check in-memory status first
    if job_id in _memory_job_status:
        return _memory_job_status[job_id]
    
    # Or check if report exists directly in trip_reports
    db = get_database()
    report = await db.trip_reports.find_one({"id": job_id})
    if report:
        return {
            "id": job_id,
            "trip_id": report["trip_id"],
            "status": "completed",
            "progress": 100,
            "result_report_id": report["id"],
            "error_message": None
        }
    return None


async def delete_report(report_id: str) -> bool:
    db = get_database()
    res = await db.trip_reports.delete_one({"id": report_id})
    return res.deleted_count > 0
