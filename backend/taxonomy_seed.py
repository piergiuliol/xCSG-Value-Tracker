"""
taxonomy_seed.py — canonical Category + Practice seed data.

Source: "PEL Data Taxonomy (Field Values).csv" (Alira Health).
Parsed once, committed as a constant — NOT read from disk at runtime.

Normalization: trailing "Ê" (Latin-1 copy-paste artifact) stripped from names;
whitespace trimmed.

Category and Practice are two INDEPENDENT fields on a project. The CSV pairs
them per row, but the seed stores each dimension separately — a project's
practice is not derived from its category.

Duplicate category names in the CSV (Regulatory Strategy, Evidence Generation
Strategy appear under two practices each) are seeded ONCE in the CATEGORIES
list. The project's practice field disambiguates them at assignment time.
"""
from typing import List, Tuple

# (code, description) — 11 practices
PRACTICES: List[Tuple[str, str]] = [
    ("RAM", ""),
    ("MAP", ""),
    ("NPS", ""),
    ("MCD", ""),
    ("RWE", ""),
    ("PEN", ""),
    ("RAP", ""),
    ("TAD", ""),
    ("CLI", ""),
    ("Other", ""),
    ("ALL", ""),
]

# 79 category names, deduped from the CSV's "Project type" column.
# Ordered alphabetically for stable seed output and predictable list rendering.
CATEGORIES: List[str] = [
    "510(k)",
    "513(g)",
    "Ad-hoc consulting for clients",
    "Advisory Boards (e.g., payer or clinical experts)",
    "Audit",
    "BDD",
    "BTD/PRIME/Fast-Track",
    "Brand Analytics",
    "Brand Strategy",
    "Business Plan Development",
    "Buy-Side M&A",
    "CER/PER activities",
    "CTA",
    "Capital Raise",
    "Clinical Strategy",
    "Commercial Due Diligence",
    "Commercial/G-t-M Strategy",
    "Consultancy - Clinical Operations",
    "Corporate Strategy/ Growth Strategy",
    "Data analysis",
    "Data mapping",
    "De Novo",
    "EU ND and NCA",
    "EU TD",
    "Early Market Access",
    "Evidence Generation Strategy",
    "Full Service Trial - Clinical Operations",
    "Gap Analysis",
    "Health Authority Meeting",
    "Health Economics (e.g., HEOR Modelling like CE, BIM)",
    "IDE",
    "IND and IND Related",
    "In-Licensing/Partnering",
    "Informational meeting",
    "Internal ad-hoc consulting",
    "MAA/NDA",
    "Market Access & Reimbursement Strategy",
    "Medical Affairs",
    "Mock Negotiation & Trainings",
    "New Product Planning/Strategy",
    "Non-Full Service - Clinical Operations",
    "ODD and ODD Related",
    "Opportunity Assessment (Market and/ or Product) (e.g., market landscape analysis, market research, opportunity assessment)",
    "Other",
    "Other - Clinical Operations",
    "Out-Licensing/Partnering",
    "PMA",
    "Patient Advisory Boards",
    "Patient Advocacy",
    "Patient Journey Definition",
    "Patient-Centric Co-Design",
    "Patient-Centric Strategy Development",
    "Payer Mock-up Negotiations",
    "Payer Value Story Payer Objection Handler",
    "Portfolio Management/ TA & Indication Prioritization",
    "Pre-RFD/RFD",
    "PreSub",
    "Product Classification and Categorization",
    "Prospective study",
    "Protocol Development",
    "QMS Gap Analysis",
    "QMS Implementation",
    "Quantitative Pricing (e.g., Van Westendorp, Gabor-Granger, monadic testing, conjoint analysis, etc.)",
    "Regulatory Feasibility/Gap analysis",
    "Regulatory Pediatric",
    "Regulatory Publishing",
    "Regulatory Roadmap",
    "Regulatory Strategy",
    "Regulatory Training",
    "Retrospective study",
    "Scientific communication",
    "Sell-Side M&A",
    "Strategic & Operational Pricing",
    "Strategic Surveillance",
    "Tox Plan",
    "Training",
    "Value Dossier (global and local adaptations)",
    "Value-Based Contracting (innovative pricing models)",
    "Vendor Due Diligence",
]

# ── Category ↔ Practice many-to-many pairings (81 rows from CSV) ────────────
# Each (category_name, practice_code) row represents an allowed pairing.
# Most categories belong to exactly one practice; two categories belong to
# two practices each and appear twice below:
#   - "Regulatory Strategy"          → RAM, RAP
#   - "Evidence Generation Strategy" → RWE, MAP
# When creating a project, the Practice dropdown is filtered to the practices
# allowed for the selected category.
CATEGORY_PRACTICE_PAIRS: List[Tuple[str, str]] = [
    # RAM (19)
    ("510(k)", "RAM"),
    ("513(g)", "RAM"),
    ("Audit", "RAM"),
    ("BDD", "RAM"),
    ("CER/PER activities", "RAM"),
    ("Clinical Strategy", "RAM"),
    ("De Novo", "RAM"),
    ("EU ND and NCA", "RAM"),
    ("EU TD", "RAM"),
    ("Gap Analysis", "RAM"),
    ("IDE", "RAM"),
    ("Informational meeting", "RAM"),
    ("PMA", "RAM"),
    ("Pre-RFD/RFD", "RAM"),
    ("PreSub", "RAM"),
    ("Product Classification and Categorization", "RAM"),
    ("QMS Gap Analysis", "RAM"),
    ("QMS Implementation", "RAM"),
    ("Regulatory Strategy", "RAM"),
    # MAP (12)
    ("Advisory Boards (e.g., payer or clinical experts)", "MAP"),
    ("Early Market Access", "MAP"),
    ("Evidence Generation Strategy", "MAP"),
    ("Health Economics (e.g., HEOR Modelling like CE, BIM)", "MAP"),
    ("Market Access & Reimbursement Strategy", "MAP"),
    ("Mock Negotiation & Trainings", "MAP"),
    ("Payer Mock-up Negotiations", "MAP"),
    ("Payer Value Story Payer Objection Handler", "MAP"),
    ("Quantitative Pricing (e.g., Van Westendorp, Gabor-Granger, monadic testing, conjoint analysis, etc.)", "MAP"),
    ("Strategic & Operational Pricing", "MAP"),
    ("Value Dossier (global and local adaptations)", "MAP"),
    ("Value-Based Contracting (innovative pricing models)", "MAP"),
    # NPS (6)
    ("Brand Analytics", "NPS"),
    ("Brand Strategy", "NPS"),
    ("Medical Affairs", "NPS"),
    ("New Product Planning/Strategy", "NPS"),
    ("Patient Advocacy", "NPS"),
    ("Strategic Surveillance", "NPS"),
    # MCD (7)
    ("Business Plan Development", "MCD"),
    ("Commercial Due Diligence", "MCD"),
    ("Commercial/G-t-M Strategy", "MCD"),
    ("Corporate Strategy/ Growth Strategy", "MCD"),
    ("Opportunity Assessment (Market and/ or Product) (e.g., market landscape analysis, market research, opportunity assessment)", "MCD"),
    ("Portfolio Management/ TA & Indication Prioritization", "MCD"),
    ("Vendor Due Diligence", "MCD"),
    # RWE (7)
    ("Data analysis", "RWE"),
    ("Data mapping", "RWE"),
    ("Evidence Generation Strategy", "RWE"),
    ("Prospective study", "RWE"),
    ("Protocol Development", "RWE"),
    ("Retrospective study", "RWE"),
    ("Scientific communication", "RWE"),
    # PEN (4)
    ("Patient Advisory Boards", "PEN"),
    ("Patient Journey Definition", "PEN"),
    ("Patient-Centric Co-Design", "PEN"),
    ("Patient-Centric Strategy Development", "PEN"),
    # RAP (15)
    ("Ad-hoc consulting for clients", "RAP"),
    ("BTD/PRIME/Fast-Track", "RAP"),
    ("CTA", "RAP"),
    ("Health Authority Meeting", "RAP"),
    ("IND and IND Related", "RAP"),
    ("Internal ad-hoc consulting", "RAP"),
    ("MAA/NDA", "RAP"),
    ("ODD and ODD Related", "RAP"),
    ("Regulatory Feasibility/Gap analysis", "RAP"),
    ("Regulatory Pediatric", "RAP"),
    ("Regulatory Publishing", "RAP"),
    ("Regulatory Roadmap", "RAP"),
    ("Regulatory Strategy", "RAP"),
    ("Regulatory Training", "RAP"),
    ("Tox Plan", "RAP"),
    # TAD (5)
    ("Buy-Side M&A", "TAD"),
    ("Capital Raise", "TAD"),
    ("In-Licensing/Partnering", "TAD"),
    ("Out-Licensing/Partnering", "TAD"),
    ("Sell-Side M&A", "TAD"),
    # CLI (4)
    ("Consultancy - Clinical Operations", "CLI"),
    ("Full Service Trial - Clinical Operations", "CLI"),
    ("Non-Full Service - Clinical Operations", "CLI"),
    ("Other - Clinical Operations", "CLI"),
    # Other (1)
    ("Other", "Other"),
    # ALL (1)
    ("Training", "ALL"),
]

assert len(PRACTICES) == 11, f"Expected 11 practices, got {len(PRACTICES)}"
assert len(CATEGORIES) == 79, f"Expected 79 categories, got {len(CATEGORIES)}"
assert len(set(CATEGORIES)) == len(CATEGORIES), "CATEGORIES contains duplicates"
assert len({code for code, _ in PRACTICES}) == len(PRACTICES), "PRACTICES contains duplicate codes"
assert len(CATEGORY_PRACTICE_PAIRS) == 81, f"Expected 81 pairings, got {len(CATEGORY_PRACTICE_PAIRS)}"
_practice_codes = {code for code, _ in PRACTICES}
_category_names = set(CATEGORIES)
for cat, prac in CATEGORY_PRACTICE_PAIRS:
    assert cat in _category_names, f"Unknown category in pairing: {cat!r}"
    assert prac in _practice_codes, f"Unknown practice in pairing: {prac!r}"
