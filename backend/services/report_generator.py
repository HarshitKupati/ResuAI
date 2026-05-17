"""
Report Generator Service
Generates PDF and text reports for resume analysis results.
"""
import os
from datetime import datetime
from typing import Dict, Any, Optional, List
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas


REPORTS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'reports')


def ensure_reports_directory():
    """Ensure reports directory exists."""
    os.makedirs(REPORTS_DIR, exist_ok=True)


def generate_text_report(
    resume_data: Dict[str, Any],
    jd_data: Optional[Dict[str, Any]] = None,
    match_result: Optional[Dict[str, Any]] = None,
    ats_result: Optional[Dict[str, Any]] = None
) -> str:
    """
    Generate a text report for resume analysis.
    
    Args:
        resume_data: Parsed resume data
        jd_data: Job description data (optional)
        match_result: Match analysis result (optional)
        ats_result: ATS score result (optional)
        
    Returns:
        Path to generated report file
    """
    ensure_reports_directory()
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"resume_analysis_{timestamp}.txt"
    filepath = os.path.join(REPORTS_DIR, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write("=" * 60 + "\n")
        f.write("         AI RESUME ANALYZER - ANALYSIS REPORT\n")
        f.write("=" * 60 + "\n\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

        # Resume Summary
        f.write("-" * 40 + "\n")
        f.write("RESUME SUMMARY\n")
        f.write("-" * 40 + "\n")
        f.write(f"Name: {resume_data.get('name', 'Not found')}\n")
        f.write(f"Education: {resume_data.get('education', 'Not specified')}\n")
        f.write(f"Experience: {resume_data.get('experience', 'Not specified')}\n\n")

        skills = resume_data.get('skills', [])
        if skills:
            f.write(f"Skills ({len(skills)}):\n")
            for skill in skills[:20]:
                f.write(f"  • {skill}\n")
            if len(skills) > 20:
                f.write(f"  ... and {len(skills) - 20} more\n")
        f.write("\n")

        # Match Results
        if match_result:
            f.write("-" * 40 + "\n")
            f.write("MATCH ANALYSIS\n")
            f.write("-" * 40 + "\n")
            f.write(f"Match Score: {match_result.get('match_score', 0):.2f}%\n")
            f.write(f"Matched Skills: {match_result.get('matched_count', 0)}/{match_result.get('total_jd_skills', 0)}\n\n")

            matched = match_result.get('matched_skills', [])
            if matched:
                f.write("Matched Skills:\n")
                for skill in matched:
                    f.write(f"  ✓ {skill}\n")

            missing = match_result.get('missing_skills', [])
            if missing:
                f.write("\nMissing Skills:\n")
                for skill in missing:
                    f.write(f"  ✗ {skill}\n")
            f.write("\n")

        # ATS Score
        if ats_result:
            f.write("-" * 40 + "\n")
            f.write("ATS SCORE ANALYSIS\n")
            f.write("-" * 40 + "\n")
            f.write(f"Overall ATS Score: {ats_result.get('ats_score', 0)}%\n")
            f.write(f"Rating: {ats_result.get('score_label', 'N/A')}\n\n")

            breakdown = ats_result.get('breakdown', {})
            if breakdown:
                f.write("Score Breakdown:\n")
                f.write(f"  Keywords:   {breakdown.get('keyword_score', 0)}%\n")
                f.write(f"  Skills:     {breakdown.get('skill_score', 0)}%\n")
                f.write(f"  Sections:   {breakdown.get('section_score', 0)}%\n")
                f.write(f"  Experience: {breakdown.get('experience_score', 0)}%\n")
            f.write("\n")

        f.write("=" * 60 + "\n")
        f.write("End of Report\n")
        f.write("=" * 60 + "\n")
    
    return filepath


def generate_summary_report(data: Dict[str, Any]) -> str:
    """
    Generate a simple summary report.
    
    Args:
        data: Any analysis data
        
    Returns:
        Path to generated report file
    """
    ensure_reports_directory()
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"summary_{timestamp}.txt"
    filepath = os.path.join(REPORTS_DIR, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write("Analysis Summary Report\n")
        f.write("=" * 40 + "\n\n")
        f.write(str(data))
    
    return filepath


def _draw_wrapped_text(c: canvas.Canvas, text: str, x: float, y: float, max_width: float, line_height: float = 14) -> float:
    """Draw wrapped text and return the new y position."""
    words = text.split()
    if not words:
        return y - line_height

    current_line = words[0]
    for word in words[1:]:
        trial = f"{current_line} {word}"
        if c.stringWidth(trial, "Helvetica", 11) <= max_width:
            current_line = trial
        else:
            c.drawString(x, y, current_line)
            y -= line_height
            current_line = word
    c.drawString(x, y, current_line)
    return y - line_height


def _new_page_if_needed(c: canvas.Canvas, y: float, threshold: float = 70) -> float:
    if y > threshold:
        return y
    c.showPage()
    c.setFont("Helvetica", 11)
    return 760


def generate_pdf_report(data: Dict[str, Any], filename: Optional[str] = None) -> str:
    """Generate a PDF report with match, ATS, role, and recommendation insights."""
    ensure_reports_directory()

    if not filename:
        filename = f"resume_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"

    filepath = os.path.join(REPORTS_DIR, filename)
    c = canvas.Canvas(filepath, pagesize=letter)
    width, _ = letter

    y = 760
    margin_x = 72
    usable_width = width - (2 * margin_x)

    c.setFont("Helvetica-Bold", 18)
    c.drawString(margin_x, y, "AI Resume Analyzer - Report")
    y -= 24

    c.setFont("Helvetica", 10)
    c.drawString(margin_x, y, f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    y -= 24

    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin_x, y, "Summary Scores")
    y -= 18

    c.setFont("Helvetica", 11)
    c.drawString(margin_x, y, f"Match Score: {data.get('match_score', 0)}%")
    y -= 16
    c.drawString(margin_x, y, f"ATS Score: {data.get('ats_score', 0)}%")
    y -= 20

    y = _new_page_if_needed(c, y)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin_x, y, "Missing Skills")
    y -= 18

    c.setFont("Helvetica", 11)
    missing_skills = data.get("missing_skills", []) or []
    if missing_skills:
        for skill in missing_skills:
            y = _new_page_if_needed(c, y)
            c.drawString(margin_x + 14, y, f"- {skill}")
            y -= 14
    else:
        c.drawString(margin_x + 14, y, "- None")
        y -= 16

    y -= 8
    y = _new_page_if_needed(c, y)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin_x, y, "Predicted Roles")
    y -= 18

    c.setFont("Helvetica", 11)
    predicted_roles = data.get("predicted_roles", []) or []
    if predicted_roles:
        for role in predicted_roles:
            y = _new_page_if_needed(c, y)
            role_name = role.get("role", "Unknown Role")
            role_score = role.get("score", 0)
            c.drawString(margin_x + 14, y, f"- {role_name} ({role_score}%)")
            y -= 14
    else:
        c.drawString(margin_x + 14, y, "- No role predictions available")
        y -= 16

    y -= 8
    y = _new_page_if_needed(c, y)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin_x, y, "Recommendations")
    y -= 18

    c.setFont("Helvetica", 11)
    recommendations = data.get("recommendations", []) or []
    if recommendations:
        for recommendation in recommendations:
            y = _new_page_if_needed(c, y)
            y = _draw_wrapped_text(c, f"- {recommendation}", margin_x + 14, y, usable_width - 14)
    else:
        c.drawString(margin_x + 14, y, "- No recommendations generated")

    c.save()
    return filepath


def generate_roadmap_pdf(guide: Dict[str, Any], filename: Optional[str] = None) -> str:
    """
    Render a saved role roadmap (output of generate_role_guide) into a clean PDF.

    The dict is expected to contain: role, summary, key_skills, tools,
    requirements, learning_path[{step, title, duration, description, resources[]}],
    estimated_time, career_growth.
    """
    ensure_reports_directory()
    role_name = (guide.get("role") or "role").strip() or "role"
    safe_role = "".join(ch if ch.isalnum() else "_" for ch in role_name).strip("_") or "role"
    if not filename:
        filename = f"roadmap_{safe_role}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"

    filepath = os.path.join(REPORTS_DIR, filename)
    c = canvas.Canvas(filepath, pagesize=letter)
    width, _ = letter

    y = 760
    margin_x = 56
    usable_width = width - (2 * margin_x)

    # ── Header ──────────────────────────────────────────────────────────
    c.setFont("Helvetica-Bold", 22)
    c.drawString(margin_x, y, "Career Roadmap")
    y -= 26
    c.setFont("Helvetica-Bold", 16)
    c.drawString(margin_x, y, role_name)
    y -= 22
    c.setFont("Helvetica-Oblique", 10)
    c.setFillGray(0.35)
    c.drawString(
        margin_x, y,
        f"Generated by ResuMatch AI on {datetime.now().strftime('%B %d, %Y at %H:%M')}",
    )
    c.setFillGray(0)
    y -= 18

    estimated = (guide.get("estimated_time") or "").strip()
    if estimated:
        c.setFont("Helvetica-Bold", 11)
        c.drawString(margin_x, y, f"Estimated time to job-ready: {estimated}")
        y -= 18

    # Divider
    c.setStrokeGray(0.85)
    c.line(margin_x, y, width - margin_x, y)
    c.setStrokeGray(0)
    y -= 18

    # ── Summary ─────────────────────────────────────────────────────────
    summary = (guide.get("summary") or "").strip()
    if summary:
        y = _new_page_if_needed(c, y)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(margin_x, y, "Summary")
        y -= 16
        c.setFont("Helvetica", 11)
        y = _draw_wrapped_text(c, summary, margin_x, y, usable_width)
        y -= 6

    def _section(title: str, items: List[str]) -> float:  # type: ignore[name-defined]
        nonlocal y
        if not items:
            return y
        y = _new_page_if_needed(c, y)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(margin_x, y, title)
        y -= 16
        c.setFont("Helvetica", 11)
        for item in items:
            y = _new_page_if_needed(c, y)
            y = _draw_wrapped_text(c, f"• {item}", margin_x + 4, y, usable_width - 4)
        y -= 6
        return y

    _section("Key skills", list(guide.get("key_skills") or []))
    _section("Tools & technologies", list(guide.get("tools") or []))
    _section("Typical requirements", list(guide.get("requirements") or []))

    # ── Learning path ───────────────────────────────────────────────────
    path = list(guide.get("learning_path") or [])
    if path:
        y = _new_page_if_needed(c, y)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(margin_x, y, "Step-by-step learning path")
        y -= 16
        for idx, step in enumerate(path, start=1):
            y = _new_page_if_needed(c, y, threshold=110)
            step_no = step.get("step", idx)
            title = (step.get("title") or "").strip() or f"Step {step_no}"
            duration = (step.get("duration") or "").strip()
            description = (step.get("description") or "").strip()
            resources = list(step.get("resources") or [])

            c.setFont("Helvetica-Bold", 11)
            header = f"Step {step_no}. {title}"
            if duration:
                header += f"  —  {duration}"
            y = _draw_wrapped_text(c, header, margin_x, y, usable_width)
            if description:
                c.setFont("Helvetica", 11)
                y = _draw_wrapped_text(c, description, margin_x + 12, y, usable_width - 12)
            if resources:
                c.setFont("Helvetica-Oblique", 10)
                y = _draw_wrapped_text(
                    c,
                    "Resources: " + ", ".join(resources),
                    margin_x + 12, y, usable_width - 12,
                    line_height=12,
                )
            y -= 4

    # ── Career growth ───────────────────────────────────────────────────
    growth = list(guide.get("career_growth") or [])
    if growth:
        y = _new_page_if_needed(c, y)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(margin_x, y, "Where this leads next")
        y -= 16
        c.setFont("Helvetica", 11)
        for item in growth:
            y = _new_page_if_needed(c, y)
            y = _draw_wrapped_text(c, f"→ {item}", margin_x + 4, y, usable_width - 4)

    # ── Footer ──────────────────────────────────────────────────────────
    c.setFont("Helvetica-Oblique", 9)
    c.setFillGray(0.5)
    c.drawString(margin_x, 36, "ResuMatch AI · Career Roadmap")
    c.setFillGray(0)

    c.save()
    return filepath
