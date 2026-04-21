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

assert len(PRACTICES) == 11, f"Expected 11 practices, got {len(PRACTICES)}"
assert len(CATEGORIES) == 79, f"Expected 79 categories, got {len(CATEGORIES)}"
assert len(set(CATEGORIES)) == len(CATEGORIES), "CATEGORIES contains duplicates"
assert len({code for code, _ in PRACTICES}) == len(PRACTICES), "PRACTICES contains duplicate codes"
