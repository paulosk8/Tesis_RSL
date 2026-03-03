import sys
import json
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import matplotlib.patheffects as pe
import pandas as pd
import numpy as np
import argparse

# Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Estilo acadÃƒÂ©mico global (similar a revistas cientÃƒÂ­ficas) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
plt.rcParams.update({
    'font.family': 'serif',
    'font.serif': ['Times New Roman', 'DejaVu Serif', 'Georgia', 'serif'],
    'font.size': 10,
    'axes.titlesize': 12,
    'axes.labelsize': 11,
    'xtick.labelsize': 10,
    'ytick.labelsize': 10,
    'legend.fontsize': 9,
    'figure.dpi': 300,
    'savefig.dpi': 300,
    'axes.linewidth': 0.8,
    'grid.linewidth': 0.5,
    'lines.linewidth': 1.2,
    'lines.markersize': 5,
})

def ensure_dir(directory):
    if not os.path.exists(directory):
        os.makedirs(directory)

def save_figure(fig, output_path, **kwargs):
    """
    Save figure in both PNG and PDF (vector) formats.
    The PNG path is the primary output; PDF is saved alongside automatically.
    """
    defaults = {'dpi': 300, 'bbox_inches': 'tight', 'facecolor': 'white', 'edgecolor': 'none'}
    defaults.update(kwargs)
    # Save PNG (raster)
    fig.savefig(output_path, **defaults)
    # Save PDF (vector) alongside
    pdf_path = os.path.splitext(output_path)[0] + '.pdf'
    pdf_kwargs = {k: v for k, v in defaults.items() if k != 'dpi'}
    pdf_kwargs['format'] = 'pdf'
    try:
        fig.savefig(pdf_path, **pdf_kwargs)
    except Exception as e:
        print(f"Ã¢Å¡Â Ã¯Â¸Â  Could not save PDF vector version: {e}", file=sys.stderr)

def draw_prisma(data, output_path):
    """
    PRISMA 2020 Flow Diagram — Pixel-perfect match to standard template.
    """
    fig, ax = plt.subplots(figsize=(10, 10))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    # PRISMA 2020 EXACT Colors (Black and White standard)
    HEADER_BG = '#ffffff'
    PHASE_BG = '#ffffff'
    BOX_BG = '#ffffff'
    BOX_EDGE = '#000000'
    ARROW_COLOR = '#000000'

    # Font dictionary to mimic official Arial/Helvetica closely
    font_kwargs = {'family': 'sans-serif', 'fontname': 'Arial', 'color': '#000000'}

    def draw_box(x, y, w, h, text, bg_color=BOX_BG, fontsize=9.5, edge_lw=1.0, align='center'):
        rect = FancyBboxPatch((x, y - h), w, h, boxstyle="square,pad=0",
                              linewidth=edge_lw, edgecolor=BOX_EDGE, facecolor=bg_color)
        ax.add_patch(rect)
        
        # Helper string wrapping and alignment
        lines = text.split('\n')
        line_spacing = fontsize * 0.35 + 0.5
        total_text_height = len(lines) * line_spacing
        start_y = (y - h/2) + total_text_height/2 - line_spacing/2
        
        for i, line in enumerate(lines):
            align_x = x + w/2 if align == 'center' else x + 2
            ha = 'center' if align == 'center' else 'left'
            ax.text(align_x, start_y - i * line_spacing, line, ha=ha, va='center',
                    fontsize=fontsize, **font_kwargs)

    def draw_rounded_header(x, y, w, h, text, bg=HEADER_BG):
        # PRISMA does not use rounded headers for the main top box usually, but we keep it flat if possible
        rect = FancyBboxPatch((x, y - h), w, h, boxstyle="square,pad=0",
                              linewidth=1.0, edgecolor=BOX_EDGE, facecolor=bg)
        ax.add_patch(rect)
        ax.text(x + w/2, y - h/2, text, ha='center', va='center',
                fontsize=10.5, fontweight='bold', **font_kwargs)

    def draw_phase(x, y, w, h, label):
        # The phase is a text on the far left without a box bounding it
        # Actually PRISMA template usually has just horizontal lines separating phases, or rotated text
        ax.text(x + w/2, y - h/2, label.upper(), ha='center', va='center',
                fontsize=11.5, fontweight='bold', rotation=90, **font_kwargs)

    def draw_arrow(x1, y1, x2, y2):
        # Standard flat arrow
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="-|>", color=ARROW_COLOR, lw=1.2, mutation_scale=10))

    # Data Extract
    identified = data.get('identified', 0)
    databases = data.get('databases', [])
    duplicates = data.get('duplicates', 0)
    screened = data.get('screened', 0)
    excluded = data.get('excluded', 0)
    retrieved = data.get('retrieved', 0)
    not_retrieved = data.get('not_retrieved', 0)
    assessed = data.get('assessed', 0)
    excluded_reasons = data.get('excluded_reasons', {})
    included = data.get('included', 0)
    excluded_fulltext = data.get('excluded_fulltext', max(0, assessed - included))

    # --- PIXEL PERFECT LAYOUT (Top-Left Coordinates) ---
    TOP_Y = 96
    
    PHASE_X = 1
    PHASE_W = 6
    
    MAIN_X = 9
    MAIN_W = 38
    MAIN_CENTER = MAIN_X + MAIN_W / 2
    
    SIDE_X = 54
    SIDE_W = 44
    
    GAP_Y = 6
    BOX_H = 10

    # 1. HEADER
    draw_rounded_header(MAIN_X, TOP_Y, SIDE_X+SIDE_W-MAIN_X, 4, 'Identification of new studies via databases and registers')
    
    # Draw horizontal phase lines (Official PRISMA uses these to segment the left column)
    # ax.plot([0, 100], [TOP_Y - 4 - 2, TOP_Y - 4 - 2], color="black", lw=1.0)
    
    # 2. IDENTIFICATION
    id_y = TOP_Y - 6
    id_h = BOX_H + 2
    id_text = f"Records identified from:\nDatabases (n = {identified})\nRegisters (n = 0)"
    draw_box(MAIN_X, id_y, MAIN_W, id_h, id_text, align='left')
    
    id_side_text = f"Records removed before screening:\nDuplicate records removed\n(n = {duplicates})\nRecords marked as ineligible\nby automation tools (n = 0)\nRecords removed for other\nreasons (n = 0)"
    draw_box(SIDE_X, id_y, SIDE_W, id_h, id_side_text, align='left')
    
    draw_arrow(MAIN_X + MAIN_W, id_y - id_h/2, SIDE_X, id_y - id_h/2)
    draw_phase(PHASE_X, id_y, PHASE_W, id_h, "Identification")
    
    draw_arrow(MAIN_CENTER, id_y - id_h, MAIN_CENTER, id_y - id_h - GAP_Y)

    # 3. SCREENING - Part 1
    scr_y = id_y - id_h - GAP_Y
    scr_h = BOX_H - 2
    draw_box(MAIN_X, scr_y, MAIN_W, scr_h, f"Records screened\n(n = {screened})", align='left')
    draw_box(SIDE_X, scr_y, SIDE_W, scr_h, f"Records excluded\n(n = {excluded})", align='left')
    draw_arrow(MAIN_X + MAIN_W, scr_y - scr_h/2, SIDE_X, scr_y - scr_h/2)
    draw_arrow(MAIN_CENTER, scr_y - scr_h, MAIN_CENTER, scr_y - scr_h - GAP_Y)

    # 4. RETRIEVAL - Part 2
    retr_y = scr_y - scr_h - GAP_Y
    retr_h = BOX_H - 2
    draw_box(MAIN_X, retr_y, MAIN_W, retr_h, f"Reports sought for retrieval\n(n = {retrieved})", align='left')
    draw_box(SIDE_X, retr_y, SIDE_W, retr_h, f"Reports not retrieved\n(n = {not_retrieved})", align='left')
    draw_arrow(MAIN_X + MAIN_W, retr_y - retr_h/2, SIDE_X, retr_y - retr_h/2)
    draw_arrow(MAIN_CENTER, retr_y - retr_h, MAIN_CENTER, retr_y - retr_h - GAP_Y)

    # 5. ELIGIBILITY - Part 3
    elig_y = retr_y - retr_h - GAP_Y
    elig_h = BOX_H + 4
    draw_box(MAIN_X, elig_y, MAIN_W, elig_h, f"Reports assessed for eligibility\n(n = {assessed})", align='left')
    
    exc_lines = [f"Reports excluded:"]
    if excluded_reasons and len(excluded_reasons) > 0:
        for reason, count in excluded_reasons.items():
            exc_lines.append(f"  {reason[:30]} (n = {count})")
    else:
        exc_lines.append(f"  Reason 1 (n = {max(0, excluded_fulltext - 0)})")
        exc_lines.append("  Reason 2 (n = 0)")
        exc_lines.append("  Reason 3 (n = 0)")
        
    draw_box(SIDE_X, elig_y, SIDE_W, elig_h, "\n".join(exc_lines), align='left')
    draw_arrow(MAIN_X + MAIN_W, elig_y - elig_h/2, SIDE_X, elig_y - elig_h/2)
    draw_arrow(MAIN_CENTER, elig_y - elig_h, MAIN_CENTER, elig_y - elig_h - GAP_Y)

    # Add phase text in middle
    phase_scr_h = (elig_y - scr_y) + elig_h
    draw_phase(PHASE_X, scr_y, PHASE_W, phase_scr_h, "Screening")

    # 6. INCLUDED
    inc_y = elig_y - elig_h - GAP_Y
    inc_h = BOX_H + 2
    draw_box(MAIN_X, inc_y, MAIN_W, inc_h, f"New studies included in review\n(n = {included})\nReports of new included studies\n(n = 0)", align='left')
    draw_phase(PHASE_X, inc_y, PHASE_W, inc_h, "Included")

    # Add outer bounding box (optional but often seen in PRISMA left margin outline)
    border_rect = patches.Rectangle((PHASE_X + PHASE_W + 1, inc_y - inc_h - 2), 0, (TOP_Y - (inc_y - inc_h - 2)), linewidth=1.5, edgecolor=BOX_EDGE, facecolor='none')
    ax.add_patch(border_rect)

    plt.tight_layout(rect=[0, 0, 1, 1])
    save_figure(fig, output_path)
    plt.close()


def draw_scree(data, output_path):
    """
    Priority Screening Score Distribution (Scree/Elbow Plot).
    Academic journal style: serif fonts, clean axes, minimal colors.
    """
    scores = sorted(data.get('scores', []), reverse=True)

    if not scores:
        print("Ã¢Å¡Â Ã¯Â¸Â  No hay scores disponibles para generar scree plot", file=sys.stderr)
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.text(0.5, 0.5, 'No hay datos de relevancia disponibles',
                ha='center', va='center', fontsize=12, color='#666666', family='serif')
        ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis('off')
        save_figure(fig, output_path)
        plt.close()
        return

    if len(scores) < 3:
        print(f"Ã¢Å¡Â Ã¯Â¸Â  Insuficientes scores ({len(scores)})", file=sys.stderr)
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.text(0.5, 0.5, f'Datos insuficientes ({len(scores)} puntos)\nSe requieren al menos 3 referencias',
                ha='center', va='center', fontsize=12, color='#996600', family='serif')
        ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis('off')
        save_figure(fig, output_path)
        plt.close()
        return

    df = pd.DataFrame({'Rank': list(range(1, len(scores) + 1)), 'Score': scores})

    fig, ax = plt.subplots(figsize=(8, 5))

    # â•â•â• Main line plot â•â•â•
    ax.plot(df['Rank'], df['Score'], 'o-', color='#333333', markersize=4,
            markerfacecolor='#333333', markeredgecolor='#333333', linewidth=1.2,
            label='Relevance score', zorder=3)

    # â•â•â• Fill under curve (very subtle) â•â•â•
    ax.fill_between(df['Rank'], df['Score'], color='#cccccc', alpha=0.3, zorder=1)

    # â•â•â• Median â•â•â•
    median_score = float(df['Score'].median())
    ax.axhline(y=median_score, color='#666666', linestyle='--', linewidth=0.8,
               alpha=0.8, label=f'Median: {median_score:.1%}', zorder=2)

    # â•â•â• Elbow (Knee) detection â•â•â•
    x1, y1 = 1, scores[0]
    x2, y2 = len(scores), scores[-1]
    A = y1 - y2
    B = x2 - x1
    C = x1 * y2 - x2 * y1
    denominator = (A*A + B*B) ** 0.5

    elbow_idx = -1
    if denominator != 0:
        max_dist = -1
        for i, score in enumerate(scores):
            dist = abs(A*(i+1) + B*score + C) / denominator
            if dist > max_dist:
                max_dist = dist
                elbow_idx = i + 1

    if elbow_idx != -1:
        ax.axvline(x=elbow_idx, color='#333333', linestyle=':', linewidth=1.0,
                   alpha=0.7, label=f'Cutoff point (elbow): rank {elbow_idx}', zorder=2)
        # Annotation arrow
        elbow_score = scores[elbow_idx - 1]
        ax.annotate(f'Elbow\n(rank = {elbow_idx})',
                    xy=(elbow_idx, elbow_score),
                    xytext=(elbow_idx + max(1, len(scores)*0.08), elbow_score + 0.05),
                    fontsize=8, family='serif', fontstyle='italic',
                    arrowprops=dict(arrowstyle='->', color='#333333', lw=0.8),
                    ha='left', va='bottom')

    # â•â•â• Quantile lines â•â•â•
    top_10_idx = max(1, int(len(scores) * 0.1))
    top_25_idx = max(1, int(len(scores) * 0.25))

    if top_10_idx <= len(scores):
        s10 = scores[top_10_idx - 1]
        ax.axhline(y=s10, color='#999999', linestyle='-.', linewidth=0.7,
                   alpha=0.6, label=f'Top 10% (â‰¥ {s10:.2f})')

    if top_25_idx <= len(scores):
        s25 = scores[top_25_idx - 1]
        ax.axhline(y=s25, color='#999999', linestyle=':', linewidth=0.7,
                   alpha=0.6, label=f'Top 25% (â‰¥ {s25:.2f})')

    # â•â•â• Axes formatting â•â•â•
    ax.set_xlabel('Reference Rank', fontsize=11, family='serif')
    ax.set_ylabel('Relevance Score', fontsize=11, family='serif')
    ax.set_title('Priority Screening Score Distribution (Scree Plot)',
                 fontsize=12, fontweight='bold', family='serif', pad=12)

    # Academic grid style
    ax.grid(True, linestyle='-', linewidth=0.3, alpha=0.4, color='#cccccc')
    ax.set_axisbelow(True)

    # Clean spines
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_linewidth(0.8)
    ax.spines['bottom'].set_linewidth(0.8)

    # Legend
    ax.legend(loc='upper right', frameon=True, framealpha=0.9,
              edgecolor='#cccccc', fontsize=8, fancybox=False)

    plt.tight_layout()
    save_figure(fig, output_path)
    plt.close()
    
def draw_search_table(data, output_path):
    """
    Search Strategy Table Ã¢â‚¬â€ Academic style with serif fonts and clean borders.
    """
    if not data:
        return

    import textwrap

    table_data = []
    col_labels = ['Source', 'Hits', 'Search Query']

    for item in data:
        name = item.get('name', 'Unknown')
        hits = item.get('hits', 0)
        query = item.get('searchString', '') or 'N/A'
        wrapped_query = textwrap.fill(query, width=55)
        table_data.append([name, hits, wrapped_query])

    if not table_data:
        return

    fig_height = max(3, len(table_data) * 1.2 + 2)
    fig, ax = plt.subplots(figsize=(10, fig_height))
    ax.axis('off')
    ax.axis('tight')

    ax.set_title("Table 1. Data Sources and Search Strategy Results",
                 fontsize=11, fontweight='bold', family='serif', pad=15)

    table = ax.table(cellText=table_data, colLabels=col_labels,
                     loc='center', cellLoc='left', colLoc='left')

    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1, 1.4)

    col_widths = [0.15, 0.1, 0.75]
    for key, cell in table.get_celld().items():
        row, col = key
        cell.set_edgecolor('#333333')
        cell.set_linewidth(0.5)
        if col >= 0:
            cell.set_width(col_widths[col])
        if row == 0:
            cell.set_text_props(weight='bold', family='serif')
            cell.set_facecolor('#e8e8e8')
        else:
            cell.set_text_props(family='serif')
            cell.set_facecolor('#ffffff' if row % 2 == 1 else '#f5f5f5')

    plt.tight_layout()
    save_figure(fig, output_path)
    plt.close()

def draw_temporal_distribution(data, output_path):
    """
    Temporal Distribution (Bar Chart / Line Plot).
    Shows publication years and identifies trends and peaks.
    Academic journal style with serif fonts and clean presentation.
    """
    years_data = data.get('years', {})  # { '2019': 2, '2020': 5, '2021': 8, ... }
    
    if not years_data or len(years_data) == 0:
        print("Ã¢Å¡Â Ã¯Â¸Â   No temporal data available", file=sys.stderr)
        fig, ax = plt.subplots(figsize=(10, 5))
        ax.text(0.5, 0.5, 'No temporal distribution data available',
                ha='center', va='center', fontsize=12, color='#666666', family='serif')
        ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis('off')
        save_figure(fig, output_path)
        plt.close()
        return
    
    # Convert to sorted lists
    years = sorted([int(y) for y in years_data.keys()])
    counts = [years_data[str(y)] for y in years]
    
    fig, ax = plt.subplots(figsize=(10, 6))
    
    # Bar chart
    bars = ax.bar(years, counts, color='#4a90e2', alpha=0.8, edgecolor='#333333', linewidth=0.8)
    
    # Add value labels on top of bars
    for bar in bars:
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height + 0.2,
                f'{int(height)}',
                ha='center', va='bottom', fontsize=9, family='serif', fontweight='bold')
    
    # Trend line (polynomial fit if enough data points)
    if len(years) >= 3:
        z = np.polyfit(years, counts, min(2, len(years)-1))
        p = np.poly1d(z)
        years_smooth = np.linspace(min(years), max(years), 100)
        ax.plot(years_smooth, p(years_smooth), '--', color='#e74c3c', linewidth=2, 
                alpha=0.7, label='Trend')
    
    ax.set_xlabel('Publication Year', fontsize=11, family='serif')
    ax.set_ylabel('Number of Studies', fontsize=11, family='serif')
    ax.set_title('Temporal Distribution of Included Studies', 
                 fontsize=12, fontweight='bold', family='serif', pad=12)
    
    # Format x-axis to show all years
    ax.set_xticks(years)
    ax.set_xticklabels([str(y) for y in years], rotation=45, ha='right')
    
    # Grid
    ax.grid(True, axis='y', linestyle='-', linewidth=0.3, alpha=0.4, color='#cccccc')
    ax.set_axisbelow(True)
    
    # Clean spines
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_linewidth(0.8)
    ax.spines['bottom'].set_linewidth(0.8)
    
    # Legend if trend line exists
    if len(years) >= 3:
        ax.legend(loc='upper left', frameon=True, framealpha=0.9,
                  edgecolor='#cccccc', fontsize=9, fancybox=False)
    
    plt.tight_layout()
    save_figure(fig, output_path)
    plt.close()

def draw_quality_assessment(data, output_path):
    """
    Quality Assessment (Stacked Bar Chart).
    Shows compliance with Kitchenham criteria (Yes/No/Partial).
    Uses Plotly-like colors but with Matplotlib for consistency.
    """
    questions = data.get('questions', [])  # ['Q1', 'Q2', ...]
    yes_counts = data.get('yes', [])
    no_counts = data.get('no', [])
    partial_counts = data.get('partial', [])
    
    if not questions or len(questions) == 0:
        print("Ã¢Å¡Â Ã¯Â¸Â   No quality assessment data available", file=sys.stderr)
        fig, ax = plt.subplots(figsize=(10, 5))
        ax.text(0.5, 0.5, 'No quality assessment data available',
                ha='center', va='center', fontsize=12, color='#666666', family='serif')
        ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis('off')
        save_figure(fig, output_path)
        plt.close()
        return
    
    fig, ax = plt.subplots(figsize=(12, 6))
    
    x = np.arange(len(questions))
    width = 0.6
    
    # Stacked bars
    p1 = ax.bar(x, yes_counts, width, label='Yes', color='#27ae60', alpha=0.9, edgecolor='#333333', linewidth=0.5)
    p2 = ax.bar(x, partial_counts, width, bottom=yes_counts, label='Partial', 
                color='#f39c12', alpha=0.9, edgecolor='#333333', linewidth=0.5)
    
    # Calculate bottom for 'No' bars
    bottom_no = [yes_counts[i] + partial_counts[i] for i in range(len(questions))]
    p3 = ax.bar(x, no_counts, width, bottom=bottom_no, label='No', 
                color='#e74c3c', alpha=0.9, edgecolor='#333333', linewidth=0.5)
    
    # Add percentage labels
    total = [yes_counts[i] + partial_counts[i] + no_counts[i] for i in range(len(questions))]
    for i in range(len(questions)):
        if total[i] > 0:
            yes_pct = (yes_counts[i] / total[i]) * 100
            if yes_pct >= 10:  # Only show if big enough
                ax.text(i, yes_counts[i]/2, f'{yes_pct:.0f}%', 
                        ha='center', va='center', fontsize=8, family='serif', 
                        color='white', fontweight='bold')
    
    ax.set_xlabel('Quality Criteria (Kitchenham)', fontsize=11, family='serif')
    ax.set_ylabel('Number of Studies', fontsize=11, family='serif')
    ax.set_title('Methodological Quality Assessment', 
                 fontsize=12, fontweight='bold', family='serif', pad=12)
    ax.set_xticks(x)
    ax.set_xticklabels(questions, rotation=0, ha='center', fontsize=9)
    
    # Grid
    ax.grid(True, axis='y', linestyle='-', linewidth=0.3, alpha=0.4, color='#cccccc')
    ax.set_axisbelow(True)
    
    # Clean spines
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_linewidth(0.8)
    ax.spines['bottom'].set_linewidth(0.8)
    
    # Legend
    ax.legend(loc='upper right', frameon=True, framealpha=0.9,
              edgecolor='#cccccc', fontsize=9, ncol=3, fancybox=False)
    
    plt.tight_layout()
    save_figure(fig, output_path)
    plt.close()

def draw_bubble_chart(data, output_path):
    """
    Bubble Chart for Dimension Mapping.
    X-axis: Metric, Y-axis: Tool, Bubble size: Number of studies.
    Identifies research gaps and concentrations.
    """
    entries = data.get('entries', [])  
    # entries = [{ metric: "latency", tool: "Mongoose", studies: 5 }, ...]
    
    if not entries or len(entries) == 0:
        print("Ã¢Å¡Â Ã¯Â¸Â  No hay datos para bubble chart disponibles", file=sys.stderr)
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.text(0.5, 0.5, 'No hay datos de mapeo de dimensiones disponibles',
                ha='center', va='center', fontsize=12, color='#666666', family='serif')
        ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis('off')
        save_figure(fig, output_path)
        plt.close()
        return
    
    # Extract unique metrics and tools
    metrics = sorted(list(set([e['metric'] for e in entries if 'metric' in e])))
    tools = sorted(list(set([e['tool'] for e in entries if 'tool' in e])))
    
    if not metrics or not tools:
        print("Ã¢Å¡Â Ã¯Â¸Â  Datos incompletos para bubble chart", file=sys.stderr)
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.text(0.5, 0.5, 'Datos incompletos para mapeo de dimensiones',
                ha='center', va='center', fontsize=12, color='#666666', family='serif')
        ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis('off')
        save_figure(fig, output_path)
        plt.close()
        return
    
    # Create mapping for positions
    metric_pos = {m: i for i, m in enumerate(metrics)}
    tool_pos = {t: i for i, t in enumerate(tools)}
    
    # Prepare data for scatter
    x_vals = []
    y_vals = []
    sizes = []
    colors = []
    
    # Color palette
    color_palette = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']
    
    for entry in entries:
        if 'metric' in entry and 'tool' in entry and 'studies' in entry:
            x_vals.append(metric_pos[entry['metric']])
            y_vals.append(tool_pos[entry['tool']])
            sizes.append(entry['studies'] * 300)  # Scale for visibility
            colors.append(color_palette[tool_pos[entry['tool']] % len(color_palette)])
    
    fig, ax = plt.subplots(figsize=(12, 8))
    
    # Scatter plot
    scatter = ax.scatter(x_vals, y_vals, s=sizes, c=colors, alpha=0.6, 
                         edgecolors='#333333', linewidth=1.5)
    
    # Add study count labels
    for i, entry in enumerate(entries):
        if 'metric' in entry and 'tool' in entry and 'studies' in entry:
            ax.text(x_vals[i], y_vals[i], str(entry['studies']), 
                    ha='center', va='center', fontsize=9, family='serif', 
                    fontweight='bold', color='white')
    
    ax.set_xlabel('Performance Metrics', fontsize=11, family='serif')
    ax.set_ylabel('Tools/Technologies', fontsize=11, family='serif')
    ax.set_title('Dimension Mapping: Metrics vs Tools\n(Size = Number of Studies)', 
                 fontsize=12, fontweight='bold', family='serif', pad=12)
    
    ax.set_xticks(range(len(metrics)))
    ax.set_xticklabels(metrics, rotation=45, ha='right', fontsize=9)
    ax.set_yticks(range(len(tools)))
    ax.set_yticklabels(tools, fontsize=9)
    
    # Grid
    ax.grid(True, linestyle='--', linewidth=0.3, alpha=0.3, color='#cccccc')
    ax.set_axisbelow(True)
    
    # Clean spines
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_linewidth(0.8)
    ax.spines['bottom'].set_linewidth(0.8)
    
    plt.tight_layout()
    save_figure(fig, output_path)
    plt.close()

def draw_technical_synthesis(data, output_path):
    """
    Technical Synthesis Table with Pandas - DYNAMIC VERSION.
    Comparative table of metrics extracted from studies.
    Automatically adapts to ANY metrics present in the data.
    Format: Study | Tool | [Dynamic Metrics columns]
    """
    studies_data = data.get('studies', [])
    
    if not studies_data or len(studies_data) == 0:
        print("Ã¢Å¡Â Ã¯Â¸Â  No hay datos tÃƒÂ©cnicos para sÃƒÂ­ntesis disponibles", file=sys.stderr)
        fig, ax = plt.subplots(figsize=(12, 4))
        ax.text(0.5, 0.5, 'No hay datos de sÃƒÂ­ntesis tÃƒÂ©cnica disponibles',
                ha='center', va='center', fontsize=12, color='#666666', family='serif')
        ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis('off')
        save_figure(fig, output_path)
        plt.close()
        return
    
    # Convert to DataFrame
    df = pd.DataFrame(studies_data)
    
    # Ensure required columns exist
    required_cols = ['study', 'tool']
    if not all(col in df.columns for col in required_cols):
        print("Ã¢Å¡Â Ã¯Â¸Â  Columnas requeridas faltantes en datos tÃƒÂ©cnicos", file=sys.stderr)
        return
    
    # DYNAMIC: Select ALL columns from data (except study and tool which are first)
    display_cols = ['study', 'tool']
    metric_cols = [col for col in df.columns if col not in ['study', 'tool']]
    display_cols.extend(metric_cols)
    
    # Filter out columns that are all null/empty
    non_empty_cols = ['study', 'tool']
    for col in metric_cols:
        if df[col].notna().any() and not (df[col] == '').all():
            non_empty_cols.append(col)
    
    display_cols = non_empty_cols
    df_display = df[display_cols].copy()
    
    # DYNAMIC: Format column names generically
    col_labels = []
    for col in display_cols:
        if col == 'study':
            col_labels.append('Study')
        elif col == 'tool':
            col_labels.append('Tool')
        else:
            # Generic formatting: capitalize and replace underscores
            formatted = col.replace('_', ' ').title()
            col_labels.append(formatted)
    
    # Create figure
    fig_height = max(4, len(df_display) * 0.6 + 2)
    fig, ax = plt.subplots(figsize=(14, fig_height))
    ax.axis('off')
    ax.axis('tight')
    
    ax.set_title("Technical Synthesis: Performance Metrics Comparison",
                 fontsize=12, fontweight='bold', family='serif', pad=15)
    
    # Convert DataFrame to list of lists
    table_data = df_display.values.tolist()
    
    table = ax.table(cellText=table_data, colLabels=col_labels,
                     loc='center', cellLoc='center', colLoc='center')
    
    table.auto_set_font_size(False)
    table.set_fontsize(8)
    table.scale(1, 1.6)
    
    # Style table
    for key, cell in table.get_celld().items():
        row, col = key
        cell.set_edgecolor('#333333')
        cell.set_linewidth(0.5)
        if row == 0:
            cell.set_text_props(weight='bold', family='serif', fontsize=8)
            cell.set_facecolor('#34495e')
            cell.set_text_props(color='white')
        else:
            cell.set_text_props(family='serif', fontsize=8)
            # Alternate row colors
            if row % 2 == 1:
                cell.set_facecolor('#ffffff')
            else:
                cell.set_facecolor('#ecf0f1')
    
    plt.tight_layout()
    save_figure(fig, output_path)
    plt.close()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', required=True, help='Directory to save charts')
    args = parser.parse_args()

    ensure_dir(args.output_dir)

    # Read data from stdin
    try:
        input_data = json.loads(sys.stdin.read())
        print("Ã°Å¸ÂÂ Python recibiÃƒÂ³ datos:", file=sys.stderr)
        print(f"   - Tiene 'prisma': {'prisma' in input_data}", file=sys.stderr)
        print(f"   - Tiene 'scree': {'scree' in input_data}", file=sys.stderr)
        if 'scree' in input_data:
            scores_count = len(input_data['scree'].get('scores', []))
            print(f"   - Scores en scree: {scores_count}", file=sys.stderr)
            if scores_count > 0:
                print(f"   - Primer score: {input_data['scree']['scores'][0]}", file=sys.stderr)
        print(f"   - Tiene 'search_strategy': {'search_strategy' in input_data}", file=sys.stderr)
    except json.JSONDecodeError:
        print("Error: Invalid JSON input", file=sys.stderr)
        sys.exit(1)

    results = {}

    if 'prisma' in input_data:
        prisma_path = os.path.join(args.output_dir, 'prisma_flow.png')
        draw_prisma(input_data['prisma'], prisma_path)
        results['prisma'] = 'prisma_flow.png'

    if 'scree' in input_data:
        scree_path = os.path.join(args.output_dir, 'scree_plot.png')
        draw_scree(input_data['scree'], scree_path)
        results['scree'] = 'scree_plot.png'

    if 'search_strategy' in input_data:
        chart1_path = os.path.join(args.output_dir, 'chart1_search.png')
        draw_search_table(input_data['search_strategy'], chart1_path)
        results['chart1'] = 'chart1_search.png'
    
    # New charts
    if 'temporal_distribution' in input_data:
        temporal_path = os.path.join(args.output_dir, 'temporal_distribution.png')
        draw_temporal_distribution(input_data['temporal_distribution'], temporal_path)
        results['temporal_distribution'] = 'temporal_distribution.png'
        print("Ã¢Å“â€¦ GrÃƒÂ¡fico de distribuciÃƒÂ³n temporal generado", file=sys.stderr)
    
    if 'quality_assessment' in input_data:
        quality_path = os.path.join(args.output_dir, 'quality_assessment.png')
        draw_quality_assessment(input_data['quality_assessment'], quality_path)
        results['quality_assessment'] = 'quality_assessment.png'
        print("Ã¢Å“â€¦ GrÃƒÂ¡fico de evaluaciÃƒÂ³n de calidad generado", file=sys.stderr)
    
    if 'bubble_chart' in input_data:
        bubble_path = os.path.join(args.output_dir, 'bubble_chart.png')
        draw_bubble_chart(input_data['bubble_chart'], bubble_path)
        results['bubble_chart'] = 'bubble_chart.png'
        print("Ã¢Å“â€¦ Bubble chart generado", file=sys.stderr)
    
    if 'technical_synthesis' in input_data:
        synthesis_path = os.path.join(args.output_dir, 'technical_synthesis.png')
        draw_technical_synthesis(input_data['technical_synthesis'], synthesis_path)
        results['technical_synthesis'] = 'technical_synthesis.png'
        print("Ã¢Å“â€¦ Tabla de sÃƒÂ­ntesis tÃƒÂ©cnica generada", file=sys.stderr)

    print(json.dumps(results))

if __name__ == "__main__":
    main()
