#!/usr/bin/env python3
"""Generate a consolidated project report PDF."""

from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, StyleSheet1, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

BASE = Path(__file__).resolve().parent
PDF_PATH = BASE / 'ODB_Open_API_Scientific_Figure_Reproduction_Project_Report.pdf'


pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))


def build_styles() -> StyleSheet1:
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='CJKTitle', parent=styles['Title'], fontName='STSong-Light', fontSize=22, leading=27, textColor=colors.HexColor('#102030'), alignment=TA_CENTER, spaceAfter=12))
    styles.add(ParagraphStyle(name='CJKSubtitle', parent=styles['Normal'], fontName='STSong-Light', fontSize=11, leading=15, textColor=colors.HexColor('#52616d'), alignment=TA_CENTER, spaceAfter=18))
    styles.add(ParagraphStyle(name='CJKHeading1', parent=styles['Heading1'], fontName='STSong-Light', fontSize=16, leading=21, textColor=colors.HexColor('#17324d'), spaceBefore=10, spaceAfter=8))
    styles.add(ParagraphStyle(name='CJKHeading2', parent=styles['Heading2'], fontName='STSong-Light', fontSize=13, leading=18, textColor=colors.HexColor('#24425c'), spaceBefore=8, spaceAfter=6))
    styles.add(ParagraphStyle(name='CJKBody', parent=styles['BodyText'], fontName='STSong-Light', fontSize=10.5, leading=16, alignment=TA_JUSTIFY, spaceAfter=7))
    styles.add(ParagraphStyle(name='CJKCaption', parent=styles['Italic'], fontName='STSong-Light', fontSize=9.2, leading=12, textColor=colors.HexColor('#5a6875'), alignment=TA_CENTER, spaceAfter=10))
    styles.add(ParagraphStyle(name='CJKSmall', parent=styles['BodyText'], fontName='STSong-Light', fontSize=9.2, leading=13, alignment=TA_JUSTIFY, spaceAfter=5))
    return styles


def fit_image(path: Path, max_width: float, max_height: float) -> Image:
    img = Image(str(path))
    w, h = img.imageWidth, img.imageHeight
    scale = min(max_width / w, max_height / h)
    img.drawWidth = w * scale
    img.drawHeight = h * scale
    return img


def p(text: str, style: str, styles: StyleSheet1):
    return Paragraph(text.replace('\n', '<br/>'), styles[style])


def build_story(styles: StyleSheet1):
    story = []
    story.append(p('ODB Open API 科學圖像重現專案報告', 'CJKTitle', styles))
    story.append(p('從公開海洋資料 API、研究案例類比，到 AI agent 可調用技能（skill）的整合流程', 'CJKSubtitle', styles))

    story.append(p('摘要', 'CJKHeading1', styles))
    story.append(p('本專案以 ODB 公開海洋資料 API 為核心，建立一條可重現的科學繪圖工作流程：從研究問題與論文圖像出發，將科學需求翻譯為公開 API 查詢、可驗證的資料處理與圖像設計，最後整理成可供 AI agent 直接調用的技能（skill）。本計畫完成主軸案例、備案案例、技能封裝與盲測驗證，證明公開 API 不只可供資料下載，也能支撐研究圖像類比重現與科普化轉譯。', 'CJKBody', styles))

    story.append(p('前言與動機', 'CJKHeading1', styles))
    story.append(p('許多海洋學研究圖件背後依賴私有資料、資料同化模式、事件年資料或特定研究航次，因此外部讀者即使理解研究問題，也難以用公開資料重建具科學意義的圖像。ODB 提供 SADCP、CTD、GEBCO 與 MHW 等公開 API，使得部分研究問題得以在公開環境下被重新轉譯。這個專案的目的不是逐像素重做原論文，而是建立一套可重跑、可驗證、且對資料限制保持誠實的工作流程。', 'CJKBody', styles))

    story.append(p('工作流程總覽', 'CJKHeading1', styles))
    story.append(fit_image(BASE / 'odb_api_to_skill_workflow.png', 16.5 * cm, 24.0 * cm))
    story.append(p('圖 1. 從 ODB APIs 到可重現科學圖像與 AI agent skill 的整體流程。', 'CJKCaption', styles))
    story.append(p('流程可概括為七個階段：研究問題選定、公開 API 對應、科學轉譯、可重現圖像邏輯、案例驗證、skill 封裝，以及 prompt-driven figure generation。這條鏈條的核心原則是：公開資料必須誠實使用，不應把觀測平均場說成完整事件重現，更不應將使用模式或私有資料的原論文圖件誤稱為已完全重建。', 'CJKBody', styles))

    story.append(p('使用的公開資料與工具', 'CJKHeading1', styles))
    data = [
        ['資料來源 / 工具', '用途'],
        ['ODB SADCP API', '0.25 度格點平均流場，支撐流速、流向、向量圖與 proxy 計算'],
        ['ODB CTD API', '0.25 度格點平均溫度、鹽度與密度場，支撐水團結構與剖面類比'],
        ['ODB MHW API', '月平均 SST / SST anomaly / level，支撐現象解說型圖像'],
        ['ODB GEBCO API', '海底地形與陸地背景'],
        ['Python + uv', '可重現的腳本化環境'],
        ['Basemap / Cartopy', '地圖繪圖後端'],
    ]
    table = Table(data, colWidths=[4.8 * cm, 11.2 * cm])
    table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'STSong-Light'),
        ('FONTSIZE', (0, 0), (-1, -1), 9.6),
        ('LEADING', (0, 0), (-1, -1), 12),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#eaf2fb')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#17324d')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#9db2c7')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fbff')]),
        ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(table)
    story.append(Spacer(1, 0.35 * cm))
    story.append(p('圖像設計原則', 'CJKHeading1', styles))
    story.append(p('對 gridded scalar 場，採用格網填色而非重疊圓點；對 vector 場，只表達流向與速度，不與同一流場量重複編碼；colorbar 採外置、細短形式；GEBCO 可作地形背景，但不應掩蓋主資訊。這些規則後續都被整理進 `odb-openapi-ocean-maps` skill。', 'CJKBody', styles))

    story.append(PageBreak())

    story.append(p('主軸案例：黑潮分支流與日本鰻苗輸送', 'CJKHeading1', styles))
    story.append(p('主軸案例以 Han et al. (2021) 為出發點，問題聚焦於：在公開 0.25 度流場下，哪些背景流況較支持黑潮水向西侵入南海北部與臺灣海峽。與原論文不同，本專案不觸及 ENSO 年門檻、漁獲統計或完整輸送模擬，而是建立可重算的流場 proxy。', 'CJKBody', styles))
    story.append(fit_image(BASE / 'kbc_analog_annual.png', 16.2 * cm, 9.4 * cm))
    story.append(p('圖 2. KBC 主圖：年平均流場，背景為 20–300 m 平均流速，箭頭為近表層流向。', 'CJKCaption', styles))
    story.append(fit_image(BASE / 'kbc_analog_monsoon.png', 16.2 * cm, 7.6 * cm))
    story.append(p('圖 3. 東北季風與西南季風背景流場比較。', 'CJKCaption', styles))
    story.append(fit_image(BASE / 'kbc_analog_proxy.png', 12.5 * cm, 5.8 * cm))
    story.append(p('圖 4. KBC proxy。以 121°E、21.0–22.5°N、50–150 m 斷面向西輸送強度作為 proxy index。', 'CJKCaption', styles))
    story.append(p('proxy 結果為 Annual 0.709 Sv、NE Monsoon 0.880 Sv、SW Monsoon 0.641 Sv，得到 NE > Annual > SW。這一結果比早期單純格點比例法更符合既有物理認知，也更適合作為公開流場條件下的 KBC 類比指標。', 'CJKBody', styles))

    story.append(PageBreak())

    story.append(p('備案案例成果', 'CJKHeading1', styles))
    story.append(p('備案的目的在於測試公開 ODB APIs 是否能支撐更多不同類型的海洋學科學圖件。', 'CJKBody', styles))
    story.append(p('備案 1：SAE 次表層反氣旋渦旋類比', 'CJKHeading2', styles))
    story.append(p('此案例結合 ODB CTD 與 SADCP，使用鹽度背景、次表層向量與剖面圖來表達次表層暖鹽結構。它不是事件重現，而是證明在公開 CTD API 的支持下，原本僅靠流速無法支撐的水團結構問題，可以被提升為較具科學意義的結構類比。', 'CJKBody', styles))
    story.append(fit_image(Path('/Users/cywhale/proj/apigate/examples/sae_ctd_sadcp_analog/sae_analog_ctd_sadcp.png'), 16.0 * cm, 10.3 * cm))
    story.append(p('圖 5. SAE 結構類比：CTD 鹽度背景與 SADCP 向量，加上溫度 / 鹽度剖面。', 'CJKCaption', styles))
    story.append(p('備案 2：黑潮大蛇行 Fig.1 類型解說圖', 'CJKHeading2', styles))
    story.append(p('此案例利用 ODB MHW API 的 `sst_anomaly` 月資料，重建黑潮大蛇行期間冷水池的 Fig.1 類型解說圖。它不試圖重現原論文的完整海氣機制，而是用公開資料支撐一張具有現象解說能力的科學圖。', 'CJKBody', styles))
    story.append(fit_image(Path('/Users/cywhale/proj/apigate/examples/kuroshio_large_meander_fig1/kuroshio_large_meander_fig1_like.png'), 16.0 * cm, 10.2 * cm))
    story.append(p('圖 6. 黑潮大蛇行 Fig.1 類型解說圖。', 'CJKCaption', styles))

    story.append(PageBreak())

    story.append(p('Skill 建置與 AI Agent 驗證', 'CJKHeading1', styles))
    story.append(p('在案例完成後，本專案將資料流程、圖像規則與限制整理成 `odb-openapi-ocean-maps` skill。skill 內容包含 helper scripts、Basemap / Cartopy backend 選擇、GEBCO tiled fetch、參數 cheatsheet、colorbar 與 gridded scalar 表達規則，以及 science caveats。', 'CJKBody', styles))
    story.append(p('日本鰻 Fig.1 類比與 skill 驗證', 'CJKHeading2', styles))
    story.append(p('這組案例說明：原論文 Figure 1 主要來自 JCOPE2 資料同化再分析模式，因此其流場本來就比 ODB 公開觀測平均場更平滑、更完整。公開圖的目的不是逐像素複製，而是用誠實的觀測平均場做科普類比。', 'CJKBody', styles))
    story.append(fit_image(Path('/Users/cywhale/proj/apigate/examples/japanese_eel_fig1_skill_test/japanese_eel_fig1_skill_test.png'), 14.8 * cm, 9.8 * cm))
    story.append(p('圖 7. Japanese eel Fig.1 的公開觀測類比圖。', 'CJKCaption', styles))
    story.append(p('短 prompt 盲測', 'CJKHeading2', styles))
    story.append(p('在沒有既有腳本可借用的情況下，skill 仍能根據簡短 prompt 生成正確的雙子圖：上圖為 gridded scalar current，下圖為 vector map。這證明 skill 已不只是一份文件，而是足以支撐 agent 直接出圖的工作流。', 'CJKBody', styles))
    story.append(fit_image(Path('/Users/cywhale/proj/apigate/examples/kuroshio_skill_prompt_blind_test/kuroshio_skill_prompt_blind_test.png'), 14.2 * cm, 11.0 * cm))
    story.append(p('圖 8. 短 prompt 盲測結果：上圖為 gridded scalar current，下圖為 vector map。', 'CJKCaption', styles))

    story.append(p('限制與原則', 'CJKHeading1', styles))
    story.append(p('本專案持續遵守幾個原則：不以公開 0.25 度平均場冒充原始事件資料；不以觀測平均圖宣稱重現資料同化模式結果；不以單張圖取代原論文的全部證據鏈；若原論文使用模式或私有資料，則明示本圖為類比或解說圖。', 'CJKBody', styles))
    story.append(p('結論', 'CJKHeading1', styles))
    story.append(p('本專案證明，ODB Open APIs 不只是資料查詢接口，而可以被組織成一條公開、可重跑、對科學限制誠實的研究圖像工作流程。透過案例開發、圖像驗證與 skill 抽象化，原本分散於 API 查詢、繪圖腳本與研究說明之間的經驗，已被整理成一套可供人與 AI agent 共同使用的 reproducible workflow。', 'CJKBody', styles))
    story.append(p('參考文獻', 'CJKHeading1', styles))
    refs = [
        'Chang, YL.K., Miyazawa, Y., Miller, M.J. et al. Potential impact of ocean circulation on the declining Japanese eel catches. Scientific Reports 8, 5496 (2018). https://doi.org/10.1038/s41598-018-23820-6',
        'Han, Y.-S. et al. Potential Effect of the Intrusion of the Kuroshio Current into the South China Sea on Catches of Japanese Eel (Anguilla japonica) in the South China Sea and Taiwan Strait. Journal of Marine Science and Engineering 9(12), 1465 (2021). https://doi.org/10.3390/jmse9121465',
    ]
    for ref in refs:
        story.append(p('• ' + ref, 'CJKSmall', styles))
    return story


def add_page_number(canvas, doc):
    canvas.setFont('STSong-Light', 9)
    canvas.setFillColor(colors.HexColor('#607080'))
    canvas.drawRightString(A4[0] - 1.5 * cm, 1.0 * cm, f'{doc.page}')



def main() -> None:
    styles = build_styles()
    doc = SimpleDocTemplate(str(PDF_PATH), pagesize=A4, rightMargin=1.6 * cm, leftMargin=1.6 * cm, topMargin=1.5 * cm, bottomMargin=1.4 * cm)
    story = build_story(styles)
    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    print(f'Saved {PDF_PATH}')


if __name__ == '__main__':
    main()
