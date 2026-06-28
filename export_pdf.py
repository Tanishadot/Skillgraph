"""
Export pitch_deck.pptx to pitch_deck.pdf using Microsoft PowerPoint COM automation.
Requires Windows + Microsoft PowerPoint installed.

Usage:
    python export_pdf.py
"""
import os
import sys
from pathlib import Path

HERE = Path(__file__).parent.resolve()
PPTX = HERE / "pitch_deck.pptx"
PDF  = HERE / "pitch_deck.pdf"

def export_via_powerpoint():
    import comtypes.client
    powerpoint = comtypes.client.CreateObject("Powerpoint.Application")
    powerpoint.Visible = 1
    try:
        deck = powerpoint.Presentations.Open(str(PPTX), WithWindow=False)
        deck.SaveAs(str(PDF), 32)  # 32 = ppSaveAsPDF
        deck.Close()
        print(f"[OK] Exported -> {PDF}")
    finally:
        powerpoint.Quit()

if __name__ == "__main__":
    if not PPTX.exists():
        print(f"[ERROR] pitch_deck.pptx not found. Run: python create_pitch_deck.py first")
        sys.exit(1)
    try:
        export_via_powerpoint()
    except Exception as e:
        print(f"[ERROR] {e}")
        print("Make sure Microsoft PowerPoint is installed and try again.")
        sys.exit(1)
