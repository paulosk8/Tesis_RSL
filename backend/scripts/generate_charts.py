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
# --- Global Academic Style (Scientific Journal Quality) ---
plt.rcParams.update({
    'font.family': 'serif',
    'font.serif': ['DejaVu Serif', 'Times New Roman', 'Georgia', 'serif'],
    'font.size': 10,
    'axes.titlesize': 12,
    'axes.labelsize': 11,
    'xtick.labelsize': 10,
    'ytick.labelsize': 10,
    'legend.fontsize': 9,
    'figure.dpi': 300,
    'savefig.dpi': 300,
    'axes.linewidth': 1.0,
    'grid.linewidth': 0.5,
    'lines.linewidth': 1.5,
    'lines.markersize': 6,
})

# Professional Academic Palette
SCIENTIFIC_BLUE = '#2c3e50'
SCIENTIFIC_GRAY = '#34495e'
SCIENTIFIC_ACCENT = '#3498db'
SCIENTIFIC_SUCCESS = '#27ae60'
SCIENTIFIC_WARNING = '#f39c12'
SCIENTIFIC_DANGER = '#c0392b'

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
    PRISMA 2020 Flow Diagram — Pixel-perfect match to provided template.
    Uses exact colors: Header (#ffb732), Phase labels (#c6dbf7), and sharp black borders.
    """
    fig, ax = plt.subplots(figsize=(12, 12))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    # PRISMA 2020 Colors from Image
    HEADER_BG = '#ffb732' # Yellow
    PHASE_BG = '#c6dbf7'  # Light Blue
    BOX_BG = '#ffffff'    # White
    BOX_EDGE = '#000000'
    ARROW_COLOR = '#000000'

    # Font dictionary
    font_kwargs = {'family': 'sans-serif', 'fontname': 'Arial', 'color': '#000000'}

    def draw_box(x, y, w, h, text, bg_color=BOX_BG, fontsize=10, edge_lw=1.2, align='center', rounded=False):
        boxstyle = "round,pad=0.3,rounding_size=0.5" if rounded else "square,pad=0"
        rect = FancyBboxPatch((x, y - h), w, h, boxstyle=boxstyle,
                              linewidth=edge_lw, edgecolor=BOX_EDGE, facecolor=bg_color, mutation_scale=1.0)
        ax.add_patch(rect)
        
        # Text wrapping and vertical centering
        lines = text.split('\n')
        # Adjust line spacing for better readability
        v_spacing = h / (len(lines) + 1)
        
        for i, line in enumerate(lines):
            align_x = x + w/2 if align == 'center' else x + 1.5
            ha = 'center' if align == 'center' else 'left'
            ax.text(align_x, y - (i + 1) * v_spacing, line, ha=ha, va='center',
                    fontsize=fontsize, **font_kwargs)

    def draw_side_label(x, y, w, h, text):
        # Blue rotated side labels
        rect = FancyBboxPatch((x, y - h), w, h, boxstyle="round,pad=0.3,rounding_size=1.0",
                              linewidth=1.2, edgecolor=BOX_EDGE, facecolor=PHASE_BG)
        ax.add_patch(rect)
        ax.text(x + w/2, y - h/2, text, ha='center', va='center',
                fontsize=11, fontweight='bold', rotation=90, **font_kwargs)

    def draw_arrow(x1, y1, x2, y2, connectionstyle="arc3,rad=0"):
        # Sharp arrows matching the template
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="-|>", color=ARROW_COLOR, lw=1.5, 
                                  mutation_scale=15, shrinkA=0, shrinkB=0,
                                  connectionstyle=connectionstyle))

    # Data Extraction
    identified = data.get('identified', 0)
    duplicates = data.get('duplicates', 0)
    screened = data.get('screened', 0)
    excluded = data.get('excluded', 0)
    retrieved = data.get('retrieved', 0)
    not_retrieved = data.get('not_retrieved', 0)
    assessed = data.get('assessed', 0)
    excluded_reasons = data.get('excluded_reasons', {})
    included = data.get('included', 0)
    
    # Calculate excluded fulltext accurately
    excluded_fulltext = max(0, assessed - included)

    # --- PIXEL PERFECT LAYOUT ---
    TOP_Y = 95
    MAIN_X = 15
    MAIN_W = 38
    MAIN_CENTER = MAIN_X + MAIN_W / 2
    
    SIDE_X = 58
    SIDE_W = 38
    
    LABEL_X = 7
    LABEL_W = 5
    
    GAP_Y = 7
    BOX_H = 10

    # 1. TOP HEADER (YELLOW ROUNDED)
    draw_box(MAIN_X, TOP_Y, (SIDE_X + SIDE_W) - MAIN_X, 5, 
             'New studies identified via databases/registers', 
             bg_color=HEADER_BG, align='center', fontsize=12, rounded=True)
    
    # 2. IDENTIFICATION
    id_y = TOP_Y - 8
    id_h = 12
    draw_box(MAIN_X, id_y, MAIN_W, id_h, 
             f"Records identified:\nDatabases (n = {identified})\nRegisters (n = 0)", 
             align='center')
    
    draw_box(SIDE_X, id_y, SIDE_W, id_h, 
             f"Removed before screening:\nDuplicates (n = {duplicates})\nIneligible by AI (n = 0)\nOther reasons (n = 0)", 
             align='center')
    
    draw_arrow(MAIN_X + MAIN_W, id_y - id_h/2, SIDE_X, id_y - id_h/2)
    draw_side_label(LABEL_X, id_y, LABEL_W, id_h, "Identification")
    
    # Arrow to Screened
    next_y = id_y - id_h - GAP_Y
    draw_arrow(MAIN_CENTER, id_y - id_h, MAIN_CENTER, next_y)

    # 3. SCREENED
    scr_y = next_y
    scr_h = 7
    draw_box(MAIN_X, scr_y, MAIN_W, scr_h, f"Records screened\n(n = {screened})")
    draw_box(SIDE_X, scr_y, SIDE_W, scr_h, f"Records excluded\n(n = {excluded})")
    draw_arrow(MAIN_X + MAIN_W, scr_y - scr_h/2, SIDE_X, scr_y - scr_h/2)
    
    # Arrow to Seeked
    next_y = scr_y - scr_h - GAP_Y
    draw_arrow(MAIN_CENTER, scr_y - scr_h, MAIN_CENTER, next_y)

    # 4. SOUGHT
    sou_y = next_y
    sou_h = 7
    draw_box(MAIN_X, sou_y, MAIN_W, sou_h, f"Reports sought\n(n = {retrieved})")
    draw_box(SIDE_X, sou_y, SIDE_W, sou_h, f"Reports not retrieved\n(n = {not_retrieved})")
    draw_arrow(MAIN_X + MAIN_W, sou_y - sou_h/2, SIDE_X, sou_y - sou_h/2)
    
    # Arrow to Eligibility
    next_y = sou_y - sou_h - GAP_Y
    draw_arrow(MAIN_CENTER, sou_y - sou_h, MAIN_CENTER, next_y)

    # 5. ELIGIBILITY
    eli_y = next_y
    eli_h = 12
    draw_box(MAIN_X, eli_y, MAIN_W, eli_h, f"Assessed for eligibility\n(n = {assessed})")
    
    # Reasons for exclusion - COMPACTED to 2-3 terms
    exc_lines = [f"Excluded (n = {excluded_fulltext}):"]
    if excluded_reasons:
        # Take top 3 reasons and compact them
        for reason, count in list(excluded_reasons.items())[:3]:
            # Compact reason to max 2 words
            compact_reason = " ".join(reason.split()[:2])
            exc_lines.append(f"{compact_reason} (n = {count})")
    else:
        exc_lines.append(f"Ineligible (n = {excluded_fulltext})")
        
    draw_box(SIDE_X, eli_y, SIDE_W, eli_h, "\n".join(exc_lines))
    draw_arrow(MAIN_X + MAIN_W, eli_y - eli_h/2, SIDE_X, eli_y - eli_h/2)
    
    # Side Label for Screening (covers Screened to Eligibility)
    draw_side_label(LABEL_X, scr_y, LABEL_W, (scr_y - eli_y) + eli_h, "Screening")
    
    # Arrow to Included
    next_y = eli_y - eli_h - GAP_Y
    draw_arrow(MAIN_CENTER, eli_y - eli_h, MAIN_CENTER, next_y)

    # 6. INCLUDED
    inc_y = next_y
    inc_h = 12
    draw_box(MAIN_X, inc_y, MAIN_W, inc_h, 
             f"Included in review\n(n = {included})\nPublished reports\n(n = {included})")
    draw_side_label(LABEL_X, inc_y, LABEL_W, inc_h, "Included")

    plt.tight_layout()
    save_figure(fig, output_path)
    plt.close()

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
    # Main line plot
    ax.plot(df['Rank'], df['Score'], 'o-', color=SCIENTIFIC_BLUE, markersize=5,
            markerfacecolor=SCIENTIFIC_BLUE, markeredgecolor=SCIENTIFIC_BLUE, linewidth=1.5,
            label='Relevance score', zorder=3)

    # â•â•â• Fill under curve (very subtle) â•â•â•
    # Fill under curve
    ax.fill_between(df['Rank'], df['Score'], color=SCIENTIFIC_ACCENT, alpha=0.15, zorder=1)

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

    ax.set_title("Data Sources and Search Strategy Results",
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
    bars = ax.bar(years, counts, color=SCIENTIFIC_BLUE, alpha=0.85, edgecolor=SCIENTIFIC_GRAY, linewidth=1.0)
    
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
    p1 = ax.bar(x, yes_counts, width, label='Yes', color=SCIENTIFIC_SUCCESS, alpha=0.9, edgecolor=SCIENTIFIC_GRAY, linewidth=0.5)
    p2 = ax.bar(x, partial_counts, width, bottom=yes_counts, label='Partial', 
                color=SCIENTIFIC_WARNING, alpha=0.9, edgecolor=SCIENTIFIC_GRAY, linewidth=0.5)
    
    # Calculate bottom for 'No' bars
    bottom_no = [yes_counts[i] + partial_counts[i] for i in range(len(questions))]
    p3 = ax.bar(x, no_counts, width, bottom=bottom_no, label='No', 
                color=SCIENTIFIC_DANGER, alpha=0.9, edgecolor=SCIENTIFIC_GRAY, linewidth=0.5)
    
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
    
    # Count frequencies for SLR Aggregation
    metric_freq = {}
    tool_freq = {}
    for e in entries:
        m = e.get('metric')
        t = e.get('tool')
        s = e.get('studies', 0)
        if m: metric_freq[m] = metric_freq.get(m, 0) + s
        if t: tool_freq[t] = tool_freq.get(t, 0) + s

    # Get top 12 metrics and tools
    top_metrics = sorted(metric_freq, key=metric_freq.get, reverse=True)[:12]
    top_tools = sorted(tool_freq, key=tool_freq.get, reverse=True)[:12]
    
    # Create aggregated entries
    agg_entries = {}
    for e in entries:
        m = e.get('metric')
        t = e.get('tool')
        s = e.get('studies', 0)
        if not m or not t: continue
        
        m_label = m if m in top_metrics else 'Other Metrics'
        t_label = t if t in top_tools else 'Other Tools'
        
        key = (m_label, t_label)
        agg_entries[key] = agg_entries.get(key, 0) + s

    # Rebuild metrics and tools lists ensuring 'Other' is at the end
    metrics = [m for m in top_metrics]
    if any(k[0] == 'Other Metrics' for k in agg_entries.keys()) and 'Other Metrics' not in metrics:
        metrics.append('Other Metrics')
        
    tools = [t for t in top_tools]
    if any(k[1] == 'Other Tools' for k in agg_entries.keys()) and 'Other Tools' not in tools:
        tools.append('Other Tools')

    # Reassign entries for downstream logic
    entries = [{'metric': k[0], 'tool': k[1], 'studies': v} for k, v in agg_entries.items()]
    
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
    
    # Dynamic sizing based on data length
    fig_width = max(12, len(metrics) * 0.8)
    fig_height = max(8, len(tools) * 0.6)
    fig, ax = plt.subplots(figsize=(fig_width, fig_height))
    
    use_heatmap = len(entries) > 30 or (len(metrics) * len(tools) > 40)
    
    if use_heatmap:
        # Create Heatmap for Dense SLR Datasets
        heatmap_data = np.zeros((len(tools), len(metrics)))
        for entry in entries:
            if 'metric' in entry and 'tool' in entry and 'studies' in entry:
                m_idx = metric_pos[entry['metric']]
                t_idx = tool_pos[entry['tool']]
                heatmap_data[t_idx, m_idx] += entry['studies']
                
        # Use a professional blue colormap
        im = ax.imshow(heatmap_data, cmap='Blues', aspect='auto')
        
        # Colorbar
        cbar = ax.figure.colorbar(im, ax=ax)
        cbar.ax.set_ylabel("Number of Studies", rotation=-90, va="bottom", family='serif', labelpad=15)
        
        # Annotate cells with counts
        threshold = np.max(heatmap_data) / 2.0
        for i in range(len(tools)):
            for j in range(len(metrics)):
                val = heatmap_data[i, j]
                if val > 0:
                    text_color = "white" if val > threshold else "black"
                    ax.text(j, i, int(val), ha="center", va="center", color=text_color, family='serif', fontweight='bold', fontsize=9)
                    
        ax.set_title('Dimension Mapping: Metrics vs Tools (Heatmap Overview)', fontsize=12, fontweight='bold', family='serif', pad=12)
        
    else:
        # Prepare data for scatter
        x_vals = []
        y_vals = []
        sizes = []
        colors = []
        
        color_palette = [SCIENTIFIC_BLUE, SCIENTIFIC_ACCENT, SCIENTIFIC_SUCCESS, SCIENTIFIC_WARNING, SCIENTIFIC_DANGER, SCIENTIFIC_GRAY]
        
        for entry in entries:
            if 'metric' in entry and 'tool' in entry and 'studies' in entry:
                x_vals.append(metric_pos[entry['metric']])
                y_vals.append(tool_pos[entry['tool']])
                sizes.append(entry['studies'] * 300)
                colors.append(color_palette[tool_pos[entry['tool']] % len(color_palette)])
        
        max_studies = max([e['studies'] for e in entries if 'studies' in e]) if entries else 1
        base_size = 1500 / max_studies
        scaled_sizes = [s / 300 * base_size for s in sizes]
        
        scatter = ax.scatter(x_vals, y_vals, s=scaled_sizes, c=colors, alpha=0.6, edgecolors='#333333', linewidth=1.5)
        
        for i, entry in enumerate(entries):
            if 'metric' in entry and 'tool' in entry and 'studies' in entry:
                ax.text(x_vals[i], y_vals[i], str(entry['studies']), ha='center', va='center', fontsize=9, family='serif', fontweight='bold', color='white')
        
        ax.set_title('Dimension Mapping: Metrics vs Tools\n(Size = Number of Studies)', fontsize=12, fontweight='bold', family='serif', pad=12)
        
    ax.set_xlabel('Performance Metrics', fontsize=11, family='serif')
    ax.set_ylabel('Tools/Technologies', fontsize=11, family='serif')
    
    ax.set_xticks(range(len(metrics)))
    ax.set_xticklabels(metrics, rotation=45, ha='right', rotation_mode='anchor', fontsize=9)
    ax.set_yticks(range(len(tools)))
    ax.set_yticklabels(tools, fontsize=9)
    
    if not use_heatmap:
        ax.grid(True, linestyle='--', linewidth=0.3, alpha=0.3, color='#cccccc')
        ax.set_axisbelow(True)
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
    # Filter out columns that are all null/empty and keep valid metrics
    non_empty_metrics = []
    for col in metric_cols:
        if df[col].notna().any() and not (df[col] == '').all():
            # Count how many non-null values it has to sort by relevance/frequency
            non_empty_metrics.append((col, df[col].notna().sum()))
            
    # Sort metrics by frequency (descending) and take top 3 for extreme readability
    non_empty_metrics.sort(key=lambda x: x[1], reverse=True)
    top_metrics = [m[0] for m in non_empty_metrics[:3]]
    
    display_cols = ['study', 'tool'] + top_metrics
    df_display = df[display_cols].copy()
    
    # Cap studies natively to Top 10 according to SLR methodology for large datasets
    if len(df_display) > 10:
        df_display = df_display.head(10)
        # Add a footer note below
        table_note = "Table truncated to display the top 10 most relevant studies and the top 3 primary metrics."
    else:
        table_note = ""
    
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

def draw_keyword_concentration(data, output_path):
    """
    Keyword Concentration (Horizontal Bar Chart).
    Shows frequency of technical terms across included studies.
    Identifies thematic focus.
    """
    keywords_data = data.get('keywords', {})
    blacklist = data.get('keyword_blacklist', [])
    
    # Default blacklist for common irrelevant words in systematic reviews
    DEFAULT_BLACKLIST = [
        'research', 'study', 'analysis', 'system', 'software', 'paper', 'article',
        'result', 'finding', 'method', 'approach', 'process', 'data', 'performance',
        'evaluation', 'using', 'based', 'proposed', 'context', 'field', 'review',
        'literature', 'survey', 'objective', 'conclusion', 'introduction',
        'table', 'figure', 'n/r', 'unknown', 'null', 'nan'
    ]
    
    combined_blacklist = set([word.lower() for word in DEFAULT_BLACKLIST] + [word.lower() for word in blacklist])
    
    if not keywords_data or len(keywords_data) == 0:
        print("⚠  No keyword data available", file=sys.stderr)
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.text(0.5, 0.5, 'No keyword concentration data available',
                ha='center', va='center', fontsize=12, color='#666666', family='serif')
        ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis('off')
        save_figure(fig, output_path)
        plt.close()
        return
    
    # Filter keywords
    filtered_keywords = {
        k: v for k, v in keywords_data.items() 
        if k.lower() not in combined_blacklist and len(k) > 2
    }
    
    if not filtered_keywords:
        print("⚠  All keywords filtered out by blacklist", file=sys.stderr)
        # Fallback to unfiltered if everything is gone, but report it
        filtered_keywords = keywords_data

    # Sort and take top 15
    sorted_items = sorted(filtered_keywords.items(), key=lambda x: x[1])[-15:] # Ascending order for barh, top 15
    words = [item[0].capitalize() for item in sorted_items]
    counts = [item[1] for item in sorted_items]
    
    fig, ax = plt.subplots(figsize=(10, 7))
    
    # Horizontal bar chart
    y_pos = np.arange(len(words))
    bars = ax.barh(y_pos, counts, color=SCIENTIFIC_BLUE, alpha=0.85, edgecolor=SCIENTIFIC_GRAY, linewidth=1.0)
    
    # Add value labels
    for i, v in enumerate(counts):
        ax.text(v + 0.1, i, str(v), color='#333333', va='center', fontsize=10, fontweight='bold', family='serif')
    
    ax.set_yticks(y_pos)
    ax.set_yticklabels(words, fontsize=11, family='serif')
    ax.set_xlabel('Frequency (Count)', fontsize=11, family='serif')
    ax.set_title('Technical Keyword Concentration (Thematic Mapping)', 
                 fontsize=13, fontweight='bold', family='serif', pad=15)
    
    # Grid
    ax.grid(True, axis='x', linestyle='--', linewidth=0.3, alpha=0.4, color='#95a5a6')
    ax.set_axisbelow(True)
    
    # Clean spines
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    
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
        print("✅ Tabla de síntesis técnica generada", file=sys.stderr)

    if 'keyword_concentration' in input_data:
        kw_path = os.path.join(args.output_dir, 'keyword_concentration.png')
        draw_keyword_concentration(input_data['keyword_concentration'], kw_path)
        results['keyword_concentration'] = 'keyword_concentration.png'
        print("✅ Gráfico de concentración de keywords generado", file=sys.stderr)

    print(json.dumps(results))

if __name__ == "__main__":
    main()
