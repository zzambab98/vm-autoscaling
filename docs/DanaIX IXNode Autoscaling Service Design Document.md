<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DanaIX IXNode Autoscaling Service Design Document</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      mermaid.initialize({ 
        startOnLoad: true,
        theme: 'default',
        securityLevel: 'loose',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis',
        padding: 20
      },
      sequence: {
        diagramMarginX: 50,
        diagramMarginY: 10,
        actorMargin: 50,
        width: 150,
        height: 65,
        boxMargin: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: 35
      },
        themeVariables: {
          primaryColor: '#546bff',
          primaryTextColor: '#fff',
          primaryBorderColor: '#546bff',
          lineColor: '#546bff',
          secondaryColor: '#1fc9a7',
          tertiaryColor: '#e1e9ff',
          background: '#ffffff',
          mainBkg: '#ffffff',
          secondBkg: '#f2f6ff',
          textColor: '#0d1538',
          secondaryTextColor: 'rgba(13, 21, 56, 0.65)',
          tertiaryTextColor: '#1f2f6b'
        }
      });
    });
  </script>
  <style>
    body {
      font-family: 'Poppins', 'Noto Sans KR', 'Apple SD Gothic Neo', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: #0d1538;
      margin: 0;
      padding: 48px 32px 64px;
      background: linear-gradient(135deg, #f2f6ff 0%, #e1ecff 45%, #f8fbff 100%);
      -webkit-font-smoothing: antialiased;
      min-height: 100vh;
    }
    h1, h2, h3, h4 {
      color: #0d1538;
      margin-top: 32px;
      font-weight: 600;
    }
    h1 { 
      margin-top: 0;
      font-size: 36px;
      font-weight: 700;
      background: linear-gradient(120deg, #546bff, #1fc9a7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    h2 {
      font-size: 28px;
      margin-top: 48px;
      padding-bottom: 12px;
      border-bottom: 2px solid rgba(84, 107, 255, 0.2);
    }
    h3 {
      font-size: 22px;
      margin-top: 32px;
    }
    h4 {
      font-size: 18px;
      margin-top: 24px;
    }
    code, pre {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    pre {
      background: #0d1538;
      color: #e1e9ff;
      padding: 18px 20px;
      border-radius: 10px;
      overflow-x: auto;
      font-size: 14px;
      border: 1px solid rgba(84, 107, 255, 0.2);
      box-shadow: 0 10px 20px rgba(15, 28, 68, 0.25);
    }
    code {
      font-family: 'Poppins', 'Noto Sans KR', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 14px;
    }
    pre code {
      color: #e1e9ff;
    }
    .tag {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      background: rgba(84, 107, 255, 0.15);
      color: #546bff;
      font-size: 12px;
      font-weight: 600;
      margin-right: 6px;
    }
    .box {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.97), rgba(230, 240, 255, 0.96));
      border-radius: 18px;
      padding: 28px;
      margin: 24px 0;
      box-shadow: 0 20px 45px rgba(26, 45, 92, 0.18);
      border: 1px solid rgba(84, 107, 255, 0.25);
      backdrop-filter: blur(16px);
    }
    ul, ol { 
      margin-top: 8px;
      margin-bottom: 16px;
      padding-left: 24px;
    }
    li {
      margin: 8px 0;
      line-height: 1.7;
      color: rgba(13, 21, 56, 0.8);
    }
    a {
      color: #546bff;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.2s ease;
    }
    a:hover {
      color: #1fc9a7;
      text-decoration: underline;
    }
    p {
      margin: 12px 0;
      line-height: 1.7;
      color: rgba(13, 21, 56, 0.85);
    }
    strong {
      color: #0d1538;
      font-weight: 600;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 24px 0;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid rgba(84, 107, 255, 0.25);
      box-shadow: 0 10px 20px rgba(15, 28, 68, 0.15);
    }
    th, td {
      border-bottom: 1px solid rgba(84, 107, 255, 0.2);
      padding: 14px 16px;
      text-align: left;
    }
    th {
      background: linear-gradient(120deg, #546bff, #1fc9a7);
      color: #ffffff;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 12px;
    }
    tr:nth-child(even) {
      background-color: rgba(225, 233, 255, 0.3);
    }
    tr:hover {
      background-color: rgba(84, 107, 255, 0.1);
    }
    .warning {
      background: rgba(251, 191, 36, 0.2);
      border: 1px solid rgba(251, 191, 36, 0.35);
      border-left: 4px solid #fbbf24;
      padding: 14px 18px;
      margin: 20px 0;
      border-radius: 10px;
      color: #92400e;
      font-weight: 500;
    }
    .info {
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-left: 4px solid #3b82f6;
      padding: 14px 18px;
      margin: 20px 0;
      border-radius: 10px;
      color: #1e40af;
      font-weight: 500;
    }
    .success {
      background: rgba(52, 211, 153, 0.12);
      border: 1px solid rgba(52, 211, 153, 0.35);
      border-left: 4px solid #34d399;
      padding: 14px 18px;
      margin: 20px 0;
      border-radius: 10px;
      color: #065f46;
      font-weight: 500;
    }
    .mermaid {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.97), rgba(230, 240, 255, 0.96));
      padding: 30px;
      border-radius: 18px;
      margin: 28px 0;
      box-shadow: 0 20px 45px rgba(26, 45, 92, 0.18);
      border: 1px solid rgba(84, 107, 255, 0.25);
      overflow-x: auto;
      text-align: center;
      min-height: 200px;
      backdrop-filter: blur(16px);
    }
    /* Mermaid 다이어그램이 로드될 때까지 로딩 표시 */
    .mermaid:empty::before {
      content: "Loading diagram...";
      color: #666;
      font-style: italic;
    }
    pre code class*="language-mermaid"] {
      background: transparent !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    code.language-mermaid {
      display: none;
    }
  </style>
</head>
<body>
  <!-- 헤더 섹션 -->
  <div style="
    position: relative;
    overflow: hidden;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.97), rgba(230, 237, 255, 0.96));
    border-radius: 28px;
    padding: 40px;
    margin-bottom: 32px;
    box-shadow: 0 20px 45px rgba(26, 45, 92, 0.18);
    border: 1px solid rgba(84, 107, 255, 0.25);
    backdrop-filter: blur(16px);
  ">
    <div style="position: relative; z-index: 1;">
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 18px; flex-wrap: wrap; flex: 1;">
          <img
            src="/logo.svg"
            alt="DanaIX"
            style="height: 64px; width: auto;"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
          />
          <div style="
            width: 64px;
            height: 64px;
            background: linear-gradient(120deg, #546bff, #1fc9a7);
            border-radius: 12px;
            display: none;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            font-weight: 700;
            color: white;
            box-shadow: 0 10px 20px rgba(84, 107, 255, 0.3);
          ">V</div>
          <div>
              <p style="
                text-transform: uppercase;
                font-size: 12px;
                letter-spacing: 0.35em;
                color: rgba(13, 21, 56, 0.65);
                margin: 0;
                font-weight: 500;
              ">Dana Cloud</p>
            <h1 id="doc-title" style="
              margin-top: 6px;
              margin-bottom: 0;
              font-size: 36px;
              font-weight: 700;
              letter-spacing: -0.02em;
              color: #0d1538;
              background: none;
              -webkit-text-fill-color: #0d1538;
            ">DanaIX IXNode Autoscaling Service Design Document</h1>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button id="lang-ko-btn" onclick="switchLanguage('ko')" style="
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 20px;
            background: linear-gradient(120deg, #546bff, #7c3aed);
            color: #ffffff;
            border: none;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(84, 107, 255, 0.3);
            transition: all 0.2s;
            font-family: 'Poppins', 'Noto Sans KR', sans-serif;
          " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(84, 107, 255, 0.4)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(84, 107, 255, 0.3)';">
            <span>📄</span>
            <span>Design Document (Korean)</span>
          </button>
          <button id="lang-en-btn" onclick="switchLanguage('en')" style="
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 20px;
            background: linear-gradient(120deg, #7c3aed, #a855f7);
            color: #ffffff;
            border: none;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
            transition: all 0.2s;
            opacity: 0.7;
            font-family: 'Poppins', 'Noto Sans KR', sans-serif;
          " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(124, 58, 237, 0.4)'; this.style.opacity='1';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(124, 58, 237, 0.3)'; this.style.opacity='0.7';">
            <span>📄</span>
            <span>Design Doc (English)</span>
          </button>
        </div>
      </div>
      <p id="doc-description" style="
        margin-top: 18px;
        color: rgba(13, 21, 56, 0.65);
        font-size: 16px;
        line-height: 1.6;
        margin-bottom: 0;
      ">
        Control the DanaIX scaling pipeline from a single screen. This document describes the overall system architecture, operating principles, and configuration methods in detail.
      </p>

      <div style="
        margin-top: 28px;
        padding: 32px;
        border-radius: 18px;
        border: 1px solid rgba(84, 107, 255, 0.25);
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(230, 240, 255, 0.9));
        box-shadow: 0 10px 30px rgba(26, 45, 92, 0.15);
        backdrop-filter: blur(16px);
      ">
        <div style="
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 20px;
          margin-top: 0;
        ">
          <!-- React -->
          <div id="tech-react" style="
            background: #ffffff;
            border-radius: 12px;
            padding: 24px 20px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(84, 107, 255, 0.15);
            transition: transform 0.2s, box-shadow 0.2s;
          " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 20px rgba(84, 107, 255, 0.2)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.08)';">
            <div style="font-size: 36px; margin-bottom: 12px;">⚛️</div>
            <div class="tech-name" style="font-weight: 600; font-size: 16px; color: #0d1538; margin-bottom: 6px;">React</div>
            <div class="tech-desc" style="font-size: 13px; color: rgba(13, 21, 56, 0.65);">Frontend Framework</div>
          </div>

          <!-- Vite -->
          <div id="tech-vite" style="
            background: #ffffff;
            border-radius: 12px;
            padding: 24px 20px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(84, 107, 255, 0.15);
            transition: transform 0.2s, box-shadow 0.2s;
          " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 20px rgba(84, 107, 255, 0.2)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.08)';">
            <div style="font-size: 36px; margin-bottom: 12px;">⚡</div>
            <div class="tech-name" style="font-weight: 600; font-size: 16px; color: #0d1538; margin-bottom: 6px;">Vite</div>
            <div class="tech-desc" style="font-size: 13px; color: rgba(13, 21, 56, 0.65);">Build Tool</div>
          </div>

          <!-- Node.js -->
          <div id="tech-nodejs" style="
            background: #ffffff;
            border-radius: 12px;
            padding: 24px 20px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(84, 107, 255, 0.15);
            transition: transform 0.2s, box-shadow 0.2s;
          " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 20px rgba(84, 107, 255, 0.2)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.08)';">
            <div style="font-size: 36px; margin-bottom: 12px;">🟢</div>
            <div class="tech-name" style="font-weight: 600; font-size: 16px; color: #0d1538; margin-bottom: 6px;">Node.js</div>
            <div class="tech-desc" style="font-size: 13px; color: rgba(13, 21, 56, 0.65);">Backend Runtime</div>
          </div>

          <!-- vCenter -->
          <div id="tech-vcenter" style="
            background: #ffffff;
            border-radius: 12px;
            padding: 24px 20px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(84, 107, 255, 0.15);
            transition: transform 0.2s, box-shadow 0.2s;
          " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 20px rgba(84, 107, 255, 0.2)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.08)';">
            <div style="font-size: 36px; margin-bottom: 12px;">🖥️</div>
            <div class="tech-name" style="font-weight: 600; font-size: 16px; color: #0d1538; margin-bottom: 6px;">vCenter</div>
            <div class="tech-desc" style="font-size: 13px; color: rgba(13, 21, 56, 0.65);">Virtualization Platform</div>
          </div>

          <!-- GitHub -->
          <div id="tech-github" style="
            background: #ffffff;
            border-radius: 12px;
            padding: 24px 20px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(84, 107, 255, 0.15);
            transition: transform 0.2s, box-shadow 0.2s;
          " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 20px rgba(84, 107, 255, 0.2)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.08)';">
            <div style="font-size: 36px; margin-bottom: 12px;">🐙</div>
            <div class="tech-name" style="font-weight: 600; font-size: 16px; color: #0d1538; margin-bottom: 6px;">GitHub</div>
            <div class="tech-desc" style="font-size: 13px; color: rgba(13, 21, 56, 0.65);">Code Repository</div>
          </div>

          <!-- Jenkins -->
          <div id="tech-jenkins" style="
            background: #ffffff;
            border-radius: 12px;
            padding: 24px 20px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(84, 107, 255, 0.15);
            transition: transform 0.2s, box-shadow 0.2s;
          " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 20px rgba(84, 107, 255, 0.2)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.08)';">
            <div style="font-size: 36px; margin-bottom: 12px;">🔧</div>
            <div class="tech-name" style="font-weight: 600; font-size: 16px; color: #0d1538; margin-bottom: 6px;">Jenkins</div>
            <div class="tech-desc" style="font-size: 13px; color: rgba(13, 21, 56, 0.65);">CI/CD Pipeline</div>
          </div>

          <!-- F5 BIG-IP -->
          <div id="tech-f5" style="
            background: #ffffff;
            border-radius: 12px;
            padding: 24px 20px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(84, 107, 255, 0.15);
            transition: transform 0.2s, box-shadow 0.2s;
          " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 20px rgba(84, 107, 255, 0.2)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.08)';">
            <div style="font-size: 36px; margin-bottom: 12px;">⚖️</div>
            <div class="tech-name" style="font-weight: 600; font-size: 16px; color: #0d1538; margin-bottom: 6px;">F5 BIG-IP</div>
            <div class="tech-desc" style="font-size: 13px; color: rgba(13, 21, 56, 0.65);">Load Balancer</div>
          </div>

          <!-- Prometheus -->
          <div id="tech-prometheus" style="
            background: #ffffff;
            border-radius: 12px;
            padding: 24px 20px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(84, 107, 255, 0.15);
            transition: transform 0.2s, box-shadow 0.2s;
          " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 20px rgba(84, 107, 255, 0.2)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.08)';">
            <div style="font-size: 36px; margin-bottom: 12px;">📊</div>
            <div class="tech-name" style="font-weight: 600; font-size: 16px; color: #0d1538; margin-bottom: 6px;">Prometheus</div>
            <div class="tech-desc" style="font-size: 13px; color: rgba(13, 21, 56, 0.65);">Metric Collection</div>
          </div>

          <!-- Grafana -->
          <div id="tech-grafana" style="
            background: #ffffff;
            border-radius: 12px;
            padding: 24px 20px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(84, 107, 255, 0.15);
            transition: transform 0.2s, box-shadow 0.2s;
          " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 20px rgba(84, 107, 255, 0.2)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.08)';">
            <div style="font-size: 36px; margin-bottom: 12px;">📈</div>
            <div class="tech-name" style="font-weight: 600; font-size: 16px; color: #0d1538; margin-bottom: 6px;">Grafana</div>
            <div class="tech-desc" style="font-size: 13px; color: rgba(13, 21, 56, 0.65);">Monitoring Dashboard</div>
          </div>

          <!-- Loki -->
          <div id="tech-loki" style="
            background: #ffffff;
            border-radius: 12px;
            padding: 24px 20px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(84, 107, 255, 0.15);
            transition: transform 0.2s, box-shadow 0.2s;
          " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 20px rgba(84, 107, 255, 0.2)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.08)';">
            <div style="font-size: 36px; margin-bottom: 12px;">📝</div>
            <div class="tech-name" style="font-weight: 600; font-size: 16px; color: #0d1538; margin-bottom: 6px;">Loki</div>
            <div class="tech-desc" style="font-size: 13px; color: rgba(13, 21, 56, 0.65);">Log Collection</div>
          </div>

          <!-- Alertmanager -->
          <div id="tech-alertmanager" style="
            background: #ffffff;
            border-radius: 12px;
            padding: 24px 20px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(84, 107, 255, 0.15);
            transition: transform 0.2s, box-shadow 0.2s;
          " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 20px rgba(84, 107, 255, 0.2)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.08)';">
            <div style="font-size: 36px; margin-bottom: 12px;">🔔</div>
            <div class="tech-name" style="font-weight: 600; font-size: 16px; color: #0d1538; margin-bottom: 6px;">Alertmanager</div>
            <div class="tech-desc" style="font-size: 13px; color: rgba(13, 21, 56, 0.65);">Alert Management</div>
          </div>

          <!-- Node Exporter -->
          <div id="tech-nodeexporter" style="
            background: #ffffff;
            border-radius: 12px;
            padding: 24px 20px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(84, 107, 255, 0.15);
            transition: transform 0.2s, box-shadow 0.2s;
          " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 20px rgba(84, 107, 255, 0.2)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.08)';">
            <div style="font-size: 36px; margin-bottom: 12px;">📡</div>
            <div class="tech-name" style="font-weight: 600; font-size: 16px; color: #0d1538; margin-bottom: 6px;">Node Exporter</div>
            <div class="tech-desc" style="font-size: 13px; color: rgba(13, 21, 56, 0.65);">Metric Agent</div>
          </div>

          <!-- Promtail -->
          <div id="tech-promtail" style="
            background: #ffffff;
            border-radius: 12px;
            padding: 24px 20px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(84, 107, 255, 0.15);
            transition: transform 0.2s, box-shadow 0.2s;
          " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 20px rgba(84, 107, 255, 0.2)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.08)';">
            <div style="font-size: 36px; margin-bottom: 12px;">📋</div>
            <div class="tech-name" style="font-weight: 600; font-size: 16px; color: #0d1538; margin-bottom: 6px;">Promtail</div>
            <div class="tech-desc" style="font-size: 13px; color: rgba(13, 21, 56, 0.65);">Log Agent</div>
          </div>

          <!-- govc -->
          <div id="tech-govc" style="
            background: #ffffff;
            border-radius: 12px;
            padding: 24px 20px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(84, 107, 255, 0.15);
            transition: transform 0.2s, box-shadow 0.2s;
          " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 20px rgba(84, 107, 255, 0.2)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.08)';">
            <div style="font-size: 36px; margin-bottom: 12px;">🛠️</div>
            <div class="tech-name" style="font-weight: 600; font-size: 16px; color: #0d1538; margin-bottom: 6px;">govc</div>
            <div class="tech-desc" style="font-size: 13px; color: rgba(13, 21, 56, 0.65);">vCenter CLI Tool</div>
          </div>
        </div>
      </div>
    </div>
  </div>


  <!-- 1. Service Overview -->
  <h2>1. Service Overview</h2>

  <h3>1.1 IXNode Autoscaling Definition</h3>
  <p>IXNode Autoscaling operates by combining the following elements:</p>
  <ul>
    <li>VM templates and cloning via vSphere (vCenter)</li>
    <li>PLG Stack (Prometheus, Alertmanager, Grafana)을 통한 Metric Collection 및 알림</li>
    <li>Automation of VM creation/deletion tasks via Jenkins pipelines</li>
    <li>Traffic distribution and health checks via F5 LTM Pool/VIP</li>
  </ul>

  <h3>1.2 Purpose</h3>
  <ul>
    <li>Ensure service availability through automatic scaling when load increases</li>
    <li>Optimize costs through automatic reduction when load decreases</li>
    <li>Eliminate repetitive VM creation/deletion and F5 registration tasks for DevOps/operations teams</li>
    <li>Non-intrusive architecture that maximizes reuse of existing infrastructure (PLG, F5, Jenkins, vSphere)</li>
  </ul>

  <h3>1.3 Feature Summary</h3>
  <ul>
    <li>Template-based automatic VM creation and deletion</li>
    <li>Automatic creation and deletion of Prometheus Jobs / Alert Rules / Alertmanager Routes</li>
    <li>Automatic creation and execution of Scale-Out / Scale-In Jenkins pipelines</li>
    <li>Automatic F5 Pool Member registration/removal</li>
    <li>Node Exporter / Promtail installation and integration with Prometheus, Loki, Grafana</li>
    <li>Scale event logging and notifications</li>
  </ul>

  <h3>1.4 Key Components</h3>
  <ul>
    <li><b>Frontend</b> (React): Template management, autoscaling configuration, Node Exporter/Promtail installation UI</li>
    <li><b>Backend</b> (Node.js / TypeScript): Configuration storage, validation, vCenter/PLG/Jenkins/F5 integration</li>
    <li><b>PLG Stack</b>: Prometheus, Alertmanager, Grafana</li>
    <li><b>Jenkins</b>: Autoscale-Out / Autoscale-In pipeline execution</li>
    <li><b>F5 BIG-IP LTM</b>: VIP / Pool / Health Monitor</li>
    <li><b>vSphere (vCenter + ESXi)</b>: VM and template management</li>
  </ul>

  <h3>1.5 Overall Architecture Diagram</h3>
  <div class="box">
    <div class="mermaid">flowchart TB
  subgraph UserLayer[User Layer]
    UI[Autoscaling UI&lt;br/&gt;React + Vite]
    ADMIN[Operator]
  end

  subgraph ControlLayer[Control Layer]
    subgraph Backend[Backend API Server]
      CFG[Config Service&lt;br/&gt;Config Management]
      VCAPI[vCenter Service&lt;br/&gt;VM/Template Management]
      JAPI[Jenkins Service&lt;br/&gt;Job Creation/Trigger]
      PAPI[Prometheus Service&lt;br/&gt;Job/Target Management]
      AAPI[Alertmanager Service&lt;br/&gt;Route/Webhook Management]
      F5API[F5 Service&lt;br/&gt;Pool Member Management]
      COOLDOWN[Cooldown Service&lt;br/&gt;Cooldown Management]
    end
  end

  subgraph MonitoringLayer[Monitoring Layer]
    subgraph PLG[PLG Stack]
      PM[Prometheus&lt;br/&gt;Metric Collection]
      AM[Alertmanager&lt;br/&gt;Alert Routing]
      GF[Grafana&lt;br/&gt;Dashboard]
      LOKI[Loki&lt;br/&gt;Log Collection]
    end
  end

  subgraph AutomationLayer[Automation Layer]
    subgraph CI[Jenkins]
      JN_OUT[plg-autoscale-out&lt;br/&gt;Scale-Out Pipeline]
      JN_IN[plg-autoscale-in&lt;br/&gt;Scale-In Pipeline]
    end
  end

  subgraph InfrastructureLayer[Infrastructure Layer]
    subgraph VSphere[vSphere]
      VC[vCenter&lt;br/&gt;VM Management]
      ESX[ESXi Cluster&lt;br/&gt;Hypervisor]
    end

    subgraph F5BOX[F5 BIG-IP]
      F5[F5 LTM&lt;br/&gt;VIP / Pool / Health Check]
    end

    subgraph NetworkLayer[Network]
      VLAN[VLAN 1048&lt;br/&gt;IP Pool Management]
    end
  end

  subgraph ServiceLayer[Service Layer]
    subgraph Nodes[Service VM Instances]
      VM1[VM #1&lt;br/&gt;Node Exporter&lt;br/&gt;Promtail]
      VM2[VM #2&lt;br/&gt;Node Exporter&lt;br/&gt;Promtail]
      VMN[VM #N&lt;br/&gt;Node Exporter&lt;br/&gt;Promtail]
    end
  end

  ADMIN --> UI
  UI -->|HTTP/REST| CFG
  CFG --> VCAPI
  CFG --> PAPI
  CFG --> AAPI
  CFG --> JAPI
  CFG --> F5API
  CFG --> COOLDOWN

  PAPI &lt;--&gt;|SSH/API| PM
  AAPI &lt;--&gt;|SSH/API| AM
  JAPI &lt;--&gt;|HTTP/API| JN_OUT
  JAPI &lt;--&gt;|HTTP/API| JN_IN
  VCAPI &lt;--&gt;|govc CLI| VC
  F5API &lt;--&gt;|REST API| F5

  PM -->|Metric Collection| VM1
  PM -->|Metric Collection| VM2
  PM -->|Metric Collection| VMN
  PM -->|Send Alert| AM
  AM -->|Webhook| Backend
  Backend -->|Webhook| JN_OUT
  Backend -->|Webhook| JN_IN

  JN_OUT -->|govc clone| VC
  JN_IN -->|govc destroy| VC
  JN_OUT -->|REST API| F5
  JN_IN -->|REST API| F5
  JN_OUT -->|SSH| VM1
  JN_OUT -->|SSH| VM2
  JN_OUT -->|SSH| VMN

  VC -->|VM Deployment| ESX
  VM1 -->|Traffic| F5
  VM2 -->|Traffic| F5
  VMN -->|Traffic| F5
  F5 -->|Health Check| VM1
  F5 -->|Health Check| VM2
  F5 -->|Health Check| VMN

  PM -->|Query| GF
  LOKI -->|Log Collection| VM1
  LOKI -->|Log Collection| VM2
  LOKI -->|Log Collection| VMN</div>
  </div>

  <h3>1.6 Data Flow Diagram</h3>
  <div class="box">
    <div class="mermaid">flowchart TD
  START([Config Creation/Activation]) --> CONFIG[Backend: Config Storage]
  CONFIG --> PROM_CREATE[Prometheus: Job Creation]
  CONFIG --> ALERT_CREATE[Prometheus: Alert Rule Creation]
  CONFIG --> AM_CREATE[Alertmanager: Route/Webhook Creation]
  CONFIG --> JENKINS_CREATE[Jenkins: Job Creation]

  PROM_CREATE --> METRIC[Prometheus: Metric Collection 시작]
  METRIC --> CHECK{Threshold Exceeded?}
  CHECK -->|Yes| ALERT_FIRE[Alert Firing]
  CHECK -->|No| METRIC

  ALERT_FIRE --> AM_RECEIVE[Alertmanager: Alert Reception]
  AM_RECEIVE --> AM_ROUTE{Routing Rule Matching}
  AM_ROUTE -->|Scale-Out| WEBHOOK_OUT[Backend Webhook Call]
  AM_ROUTE -->|Scale-In| WEBHOOK_IN[Backend Webhook Call]

  WEBHOOK_OUT --> CHECK_COOLDOWN_OUT{Cooldown Check}
  CHECK_COOLDOWN_OUT -->|In Cooldown| BLOCK_OUT[Block]
  CHECK_COOLDOWN_OUT -->|Available| CHECK_MAX{Max VM Count Check}
  CHECK_MAX -->|Reached| BLOCK_MAX[Block + Start Cooldown]
  CHECK_MAX -->|미Reached| JENKINS_OUT[Jenkins: Scale-Out Execution]

  WEBHOOK_IN --> CHECK_SWITCH{Scale-In Switch Check}
  CHECK_SWITCH -->|OFF| BLOCK_SWITCH[Block + Create Silence]
  CHECK_SWITCH -->|ON| CHECK_COOLDOWN_IN{Cooldown Check}
  CHECK_COOLDOWN_IN -->|In Cooldown| BLOCK_IN[Block]
  CHECK_COOLDOWN_IN -->|Available| CHECK_MIN{Min VM Count Check}
  CHECK_MIN -->|Reached| BLOCK_MIN[Block + Switch OFF + Create Silence]
  CHECK_MIN -->|미Reached| JENKINS_IN[Jenkins: Scale-In Execution]

  JENKINS_OUT --> VM_CREATE[VM Creation]
  VM_CREATE --> IP_SET[IP Configuration]
  IP_SET --> F5_ADD[F5 Add Pool]
  F5_ADD --> PROM_ADD[Prometheus Add Target]
  PROM_ADD --> COOLDOWN_START_OUT[Start Cooldown]

  JENKINS_IN --> VM_SELECT[VM Selection]
  VM_SELECT --> F5_REMOVE[F5 Remove Pool]
  F5_REMOVE --> PROM_REMOVE[Prometheus Remove Target]
  PROM_REMOVE --> VM_DELETE[VM Deletion]
  VM_DELETE --> COOLDOWN_START_IN[Start Cooldown]

  BLOCK_OUT --> END([End])
  BLOCK_MAX --> END
  BLOCK_IN --> END
  BLOCK_SWITCH --> END
  BLOCK_MIN --> END
  COOLDOWN_START_OUT --> END
  COOLDOWN_START_IN --> END</div>
  </div>

  <h3>1.7 Overall Operation Scenario Summary</h3>
  <ol>
    <li>Operator creates templates and creates/activates autoscaling configuration in the UI.</li>
    <li>Backend automatically creates Prometheus Jobs/Alert Rules, Alertmanager Routes, and Jenkins Jobs.</li>
    <li>Prometheus collects Node Exporter metrics and sends alerts to Alertmanager when thresholds are exceeded.</li>
    <li>Alertmanager가 백엔드 웹훅을 호출한다 (백엔드에서 쿨다운 및 최소/Max VM Count Check).</li>
    <li>Backend calls Jenkins Webhook when validation passes.</li>
    <li>Jenkins 파이프라인이 VM Creation/삭제, F5 Pool 등록/제거, Add Prometheus target/삭제를 수행한다.</li>
    <li>Controls min/max VM count based on the number of VM targets registered in Prometheus Jobs.</li>
  </ol>

  <h3>1.8 Component Interaction Diagram</h3>
  <div class="box">
    <div class="mermaid">graph TB
  subgraph SetupPhase[Setup Phase]
    UI1[UI: 설정 생성] --> BE1[Backend: Config Storage]
    BE1 --> PM1[Prometheus: Job Creation]
    BE1 --> AR1[Prometheus: Alert Rule Creation]
    BE1 --> AM1[Alertmanager: Route 생성]
    BE1 --> JN1[Jenkins: Job Creation]
  end

  subgraph MonitoringPhase[Monitoring Phase]
    VM_M[VM: Node Exporter] -->|Metric| PM_M[Prometheus: Collection]
    PM_M -->|Evaluation| AR_M[Alert Rule: Evaluation]
    AR_M -->|Alert Firing| AM_M[Alertmanager: Reception]
  end

  subgraph DecisionPhase[Decision Phase]
    AM_M -->|Webhook| BE_D[Backend: Webhook Reception]
    BE_D --> CD[Cooldown 체크]
    BE_D --> CNT[VM 개수 체크]
    CD -->|Pass| CNT
    CNT -->|Pass| JN_D[Jenkins: 트리거]
    CD -->|Block| BLOCK[Block]
    CNT -->|Block| BLOCK
  end

  subgraph ExecutionPhase[Execution Phase]
    JN_D -->|Scale-Out| VC_E[vCenter: VM Creation]
    JN_D -->|Scale-In| VC_D[vCenter: VM Deletion]
    VC_E --> F5_E[F5: Add Pool]
    VC_D --> F5_D[F5: Remove Pool]
    F5_E --> PM_E[Prometheus: Add Target]
    F5_D --> PM_D[Prometheus: Remove Target]
    PM_E --> COOLDOWN_E[Start Cooldown]
    PM_D --> COOLDOWN_D[Start Cooldown]
  end

  SetupPhase --> MonitoringPhase
  MonitoringPhase --> DecisionPhase
  DecisionPhase --> ExecutionPhase</div>
  </div>

  <!-- 2. Prerequisites -->
  <h2>2. Prerequisites and Preparation</h2>

  <h3>2.1 Infrastructure Preparation</h3>
  <ul>
    <li>vSphere(vCenter) 접근 Available, govc CLI 사용 Available</li>
    <li>F5 BIG-IP LTM에 대상 서비스용 Pool, VIP, HTTP Health Monitor 구성 Complete</li>
    <li>PLG Stack (Prometheus, Alertmanager, Grafana) running</li>
  </ul>

  <h3>2.2 Server and Network</h3>
  <ul>
    <li>At least 2 initial service VMs running (static IP)</li>
    <li>Node Exporter installed or use Node Exporter installation feature</li>
    <li>Define IP Pool and VLAN information for autoscaling
      <ul>
        <li>e.g., 10.255.48.220 ~ 10.255.48.230 /24, Gateway 10.255.48.1, VLAN 1048</li>
      </ul>
    </li>
  </ul>

  <!-- 3. Operation Structure -->
  <h2>3. Overall Autoscaling Operation Structure</h2>

  <h3>3.1 Scale-Out Detailed Process</h3>
  <div class="box">
    <div class="mermaid">flowchart TD
  START([Alert Triggered]) --> WEBHOOK[Backend Webhook Received]
  WEBHOOK --> CHECK_COOLDOWN{Cooldown Check}
  CHECK_COOLDOWN -->|In Cooldown| REJECT1[Block: In Cooldown]
  CHECK_COOLDOWN -->|Available| CHECK_MAX{Max VM Count Check}
  CHECK_MAX -->|currentVmCount >= maxVms| REJECT2[Block: Max Count Reached<br/>Start Cooldown]
  CHECK_MAX -->|Available| JENKINS[Jenkins Pipeline Start]
  
  JENKINS --> GET_CONFIG[Config Retrieval]
  GET_CONFIG --> IP_ALLOC[IP Allocation from IP Pool]
  IP_ALLOC --> VM_CLONE[vCenter: Template Clone]
  VM_CLONE --> VM_POWER[VM Power On]
  VM_POWER --> IP_CONFIG[SSH: IP Configuration]
  IP_CONFIG --> HEALTH_CHECK[Health Check Wait]
  HEALTH_CHECK --> F5_ADD[F5: Add Pool Member]
  F5_ADD --> PROM_ADD[Prometheus: Add Target]
  PROM_ADD --> WEBHOOK_CALLBACK[Backend: VM Creation Complete Webhook]
  WEBHOOK_CALLBACK --> COOLDOWN_START[Start Cooldown]
  COOLDOWN_START --> END([Complete])
  
  REJECT1 --> END
  REJECT2 --> END</div>
  </div>

  <h3>3.2 Scale-In Detailed Process</h3>
  <div class="box">
    <div class="mermaid">flowchart TD
  START([Alert Triggered]) --> WEBHOOK[Backend Webhook Received]
  WEBHOOK --> CHECK_COOLDOWN{Cooldown Check}
  CHECK_COOLDOWN -->|In Cooldown| REJECT1[Block: In Cooldown]
  CHECK_COOLDOWN -->|Available| CHECK_MIN{Min VM Count Check}
  CHECK_MIN -->|currentVmCount <= minVms| REJECT2[Block: Min Count Reached<br/>Start Cooldown]
  CHECK_MIN -->|Available| JENKINS[Jenkins Pipeline Start]
  
  JENKINS --> GET_CONFIG[Config Retrieval]
  GET_CONFIG --> GET_VMS[Prometheus: Target List Retrieval]
  GET_VMS --> FILTER_VMS[vCenter: Filter by VM Prefix]
  FILTER_VMS --> SELECT_VM[Select Oldest VM<br/>LIFO Method]
  SELECT_VM --> F5_REMOVE[F5: Pool Member 제거]
  F5_REMOVE --> F5_NODE[F5: Node Deletion]
  F5_NODE --> MONITOR_REMOVE[Monitoring Removal<br/>Node Exporter/Promtail]
  MONITOR_REMOVE --> PROM_REMOVE[Prometheus: Remove Target]
  PROM_REMOVE --> VM_POWER_OFF[vCenter: VM Power Off]
  VM_POWER_OFF --> VM_DELETE[vCenter: VM Deletion]
  VM_DELETE --> WEBHOOK_CALLBACK[Backend: VM Deletion Complete 웹훅]
  WEBHOOK_CALLBACK --> COOLDOWN_START[Start Cooldown]
  COOLDOWN_START --> END([Complete])
  
  REJECT1 --> END
  REJECT2 --> END</div>
  </div>

  <h3>3.3 Scale-Out Sequence Diagram</h3>
  <div class="box">
    <div class="mermaid">sequenceDiagram
  participant User as User
  participant UI as Autoscaling UI
  participant BE as Backend API
  participant PM as Prometheus
  participant AM as Alertmanager
  participant JN as Jenkins
  participant VC as vCenter
  participant F5 as F5 LTM

  User->>UI: Autoscaling Config Creation/Activation
  UI->>BE: POST /api/autoscaling/configs
  BE->>PM: Job/Alert Rule Creation
  BE->>AM: Route/Webhook Creation
  BE->>JN: Autoscale Out/In Job Creation

  PM-->>PM: Node Exporter Metric Collection
  PM-->>AM: Alert (High CPU/Memory)
  AM-->>JN: Webhook Call (scale-out)

  JN->>BE: AutoscalingConfig 조회
  BE-->>JN: Config Returned (minVms, maxVms, etc.)

  JN->>PM: Prometheus Target 조회
  JN->>JN: Calculate currentVmCount
  JN->>JN: decideScaleAction(config, state, "scale-out")
  JN->>VC: Template Clone &amp; VM Creation
  JN->>VM: Netplan IP Configuration and Health Check
  JN->>F5: Add Pool Member
  JN->>PM: Add Target</div>
  </div>

  <h3>3.4 Scale-In Sequence Diagram</h3>
  <div class="box">
    <div class="mermaid">sequenceDiagram
  participant PM as Prometheus
  participant AM as Alertmanager
  participant JN as Jenkins
  participant BE as Backend API
  participant VC as vCenter
  participant F5 as F5 LTM

  PM-->>AM: Alert (Low CPU/Memory)
  AM-->>JN: Webhook Call (scale-in)

  JN->>BE: AutoscalingConfig 조회
  BE-->>JN: 설정 반환

  JN->>PM: Prometheus Target 조회
  JN->>JN: Calculate currentVmCount
  JN->>JN: decideScaleAction(config, state, "scale-in")

  JN->>VC: VM List Retrieval by vmPrefix
  JN->>JN: Select Oldest VM
  JN->>F5: Pool Member 제거
  JN->>PM: Remove Target
  JN->>VC: VM Deletion</div>
  </div>

  <!-- 4. Data Model -->
  <h2>4. Data Model (TypeScript)</h2>

  <h3>4.1 Template Metadata</h3>
  <pre><code class="language-ts">export interface TemplateMetadata {
  id: string;
  name: string;
  sourceVmName: string;
  vcenterPath: string;
  datastore: string;
  createdAt: string;      // ISO8601
  description?: string;
  tags?: string[];
}</code></pre>

  <h3>4.2 Autoscaling Configuration</h3>
  <pre><code class="language-ts">export interface AutoscalingMonitoringConfig {
  cpuThreshold: number;            // Scale-Out CPU (%)
  memoryThreshold: number;         // Scale-Out Memory (%)
  durationMinutes: number;         // Scale-Out condition duration

  scaleInCpuThreshold: number;     // Scale-In CPU (%)
  scaleInMemoryThreshold: number;  // Scale-In Memory (%)
  scaleInDurationMinutes: number;  // Scale-In condition duration

  cooldownSeconds: number;         // Scale-In/Out common cooldown
}

export interface AutoscalingNetworkConfig {
  ipPoolStart: string;     // e.g., "10.255.48.220"
  ipPoolEnd: string;       // e.g., "10.255.48.230"
  gateway: string;         // e.g., "10.255.48.1"
  subnetCidr: string;      // e.g., "10.255.48.0/24"
  vlanId: number;          // e.g., 1048
}

export interface AutoscalingF5Config {
  poolName: string;        // e.g., "auto-vm-test-pool"
  vipAddress: string;      // e.g., "10.255.48.229"
  vipPort: number;         // e.g., 80
  healthCheckPath: string; // e.g., "/health"
}

export interface AutoscalingConfig {
  id: string;
  serviceName: string;         // e.g., "auto-vm-test"
  prometheusJobName: string;   // e.g., "auto-vm-test-service"

  templateId: string;
  vmPrefix: string;            // e.g., "auto-vm-test"

  minVms: number;              // Minimum VM count
  maxVms: number;              // Maximum VM count
  scaleOutStep: number;        // Number of VMs to add on scale-out
  scaleInStep: number;         // Number of VMs to remove on scale-in

  monitoring: AutoscalingMonitoringConfig;
  network: AutoscalingNetworkConfig;
  f5: AutoscalingF5Config;

  sshUser: string;             // VM access account (e.g., ubuntu)
  sshKeyPath: string;          // SSH Key path relative to Jenkins

  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}</code></pre>

  <!-- 5. Scaling Conditions -->
  <h2>5. Scale-Out / Scale-In Conditions</h2>

  <h3>5.1 Scale-Out Conditions</h3>
  <div class="info">
    <p><strong>주의:</strong> Scale-out conditions are triggered when the <strong>maximum value among all instances</strong> exceeds the threshold using the <code>max()</code> function. That is, scale-out occurs if any instance has high usage.</p>
  </div>
  
  <h4>5.1.1 CPU Usage-Based Scale-Out (Example PromQL)</h4>
  <pre><code>max(
  100 - (avg by (instance) (
    rate(node_cpu_seconds_total{mode="idle",job="&lt;JOB_NAME&gt;"}[5m])
  ) * 100)
) &gt; CPU_THRESHOLD</code></pre>

  <pre><code>max(
  (1 - (avg by (instance) (
    node_memory_MemAvailable_bytes{job="&lt;JOB_NAME&gt;"}
  ) / avg by (instance) (
    node_memory_MemTotal_bytes{job="&lt;JOB_NAME&gt;"}
  ))) * 100
) &gt; MEMORY_THRESHOLD</code></pre>

  <h3>5.2 Scale-In Conditions</h3>
  <div class="info">
    <p><strong>주의:</strong> Scale-in conditions are triggered when the <strong>maximum value of all instances</strong> is below the threshold using the <code>max()</code> function. That is, scale-in occurs only when all VMs have low usage.</p>
  </div>
  
  <h4>5.2.1 CPU and Memory Usage-Based Scale-In (Example PromQL)</h4>
  <pre><code>(
  max(
    100 - (avg by (instance) (
      rate(node_cpu_seconds_total{mode="idle",job="&lt;JOB_NAME&gt;"}[5m])
    ) * 100)
  ) &lt; SCALE_IN_CPU_THRESHOLD
)
AND
(
  max(
    (1 - (avg by (instance) (
      node_memory_MemAvailable_bytes{job="&lt;JOB_NAME&gt;"}
    ) / avg by (instance) (
      node_memory_MemTotal_bytes{job="&lt;JOB_NAME&gt;"}
    ))) * 100
  ) &lt; SCALE_IN_MEMORY_THRESHOLD
)</code></pre>
  <div class="info">
    <p><strong>설명:</strong> Scale-in occurs only when the maximum CPU/Memory usage of all instances is below the threshold using the <code>max()</code> function. That is, scale-in is triggered only when all VMs have low usage.</p>
  </div>

  <!-- 6. Scale-In/Out Decision Logic (Changes) -->
  <h2>6. Scale-In/Out Count Decision Logic (Including Changes)</h2>

  <h3>6.1 Issues Before Changes</h3>
  <ul>
    <li>When scaling in, filtering VM lists from multiple sources (vCenter, F5, Prometheus) with complex logic and then comparing counts</li>
    <li>When information from different sources is inconsistent, min/max VM count determination may differ, making the criteria inconsistent</li>
  </ul>

  <h3>6.2 Policy After Changes</h3>
  <ul>
    <li><b>Single Criteria:</b> Both scale-in and scale-out are determined based on the <b>number of VM targets registered in Prometheus Job</b> (currentVmCount)</li>
    <li><b>Scale-Out Block Condition:</b> currentVmCount &gt;= maxVms → Scale-Out Block</li>
    <li><b>Scale-In Block Condition:</b> currentVmCount &lt;= minVms → Scale-In Block</li>
    <li><b>스케일인 스위치 방식:</b> 최소 VM 개수 Reached 시 스케일인 Switch OFF, Alertmanager Create Silence하여 웹훅 자체 Block</li>
    <li><b>Automatic Switch Recovery:</b> When VM count reaches above minimum, automatically turn switch ON and delete Silence</li>
    <li><b>Start Cooldown:</b> Start cooldown when min/max count is reached to prevent pipeline overload from Alertmanager repeated alerts</li>
    <li><b>Logic Simplification:</b> Remove unnecessary duplicate checks, determine min/max count only from Prometheus Job targets</li>
    <li><b>Webhook Flow:</b> Alertmanager → Backend (validation) → Jenkins (execution)</li>
  </ul>

  <h3>6.3 Decision Logic Flowchart</h3>
  <div class="box">
    <div class="mermaid">flowchart TD
  START([Webhook Received]) --> TYPE{Scale Type}
  TYPE -->|Scale-Out| CHECK_COOLDOWN_OUT{Cooldown Check}
  TYPE -->|Scale-In| CHECK_COOLDOWN_IN{Cooldown Check}
  
  CHECK_COOLDOWN_OUT -->|In Cooldown| REJECT_COOLDOWN_OUT[Block: 쿨다운]
  CHECK_COOLDOWN_OUT -->|Available| GET_COUNT_OUT[Prometheus Target 개수 조회]
  GET_COUNT_OUT --> CHECK_MAX{currentVmCount >= maxVms?}
  CHECK_MAX -->|Yes| REJECT_MAX[Block: Max Count Reached<br/>Start Cooldown]
  CHECK_MAX -->|No| ALLOW_OUT[Allow: Scale-Out Execution]
  
  CHECK_COOLDOWN_IN -->|In Cooldown| REJECT_COOLDOWN_IN[Block: 쿨다운]
  CHECK_COOLDOWN_IN -->|Available| CHECK_SWITCH_IN{Scale-In Switch Check}
  CHECK_SWITCH_IN -->|OFF| REJECT_SWITCH[Block: Switch OFF<br/>Create Silence]
  CHECK_SWITCH_IN -->|ON| GET_COUNT_IN[Prometheus Target 개수 조회]
  GET_COUNT_IN --> CHECK_MIN{currentVmCount <= minVms?}
  CHECK_MIN -->|Yes| REJECT_MIN[Block: Min Count Reached<br/>Switch OFF + Create Silence]
  CHECK_MIN -->|No| ALLOW_IN[Allow: Scale-In Execution]
  
  REJECT_COOLDOWN_OUT --> END([End])
  REJECT_MAX --> END
  REJECT_COOLDOWN_IN --> END
  REJECT_SWITCH --> END
  REJECT_MIN --> END
  ALLOW_OUT --> END
  ALLOW_IN --> END</div>
  </div>

  <h3>6.4 TypeScript Pseudocode</h3>
  <pre><code class="language-ts">interface CurrentState {
  currentVmCount: number;       // Number of Prometheus Job targets
  lastScaleOutAt?: number;      // epoch ms
  lastScaleInAt?: number;       // epoch ms
}

function isInCooldown(
  now: number,
  lastActionAt?: number,
  cooldownSeconds?: number
): boolean {
  if (!lastActionAt || !cooldownSeconds) return false;
  return now - lastActionAt &lt; cooldownSeconds * 1000;
}

export function decideScaleAction(
  config: AutoscalingConfig,
  state: CurrentState,
  alertType: "scale-out" | "scale-in"
): "ALLOW" | "BLOCK_MIN" | "BLOCK_MAX" | "BLOCK_COOLDOWN" {
  const { minVms, maxVms, monitoring } = config;
  const { currentVmCount, lastScaleOutAt, lastScaleInAt } = state;
  const now = Date.now();

  if (alertType === "scale-out") {
    if (currentVmCount &gt;= maxVms) {
      // Max Count Reached → 스케일 아웃 Block + Start Cooldown
      return "BLOCK_MAX";
    }
    if (isInCooldown(now, lastScaleOutAt, monitoring.cooldownSeconds)) {
      return "BLOCK_COOLDOWN";
    }
    return "ALLOW";
  }

  if (alertType === "scale-in") {
    if (currentVmCount &lt;= minVms) {
      // Min Count Reached → 스케일 인 Block + Start Cooldown
      return "BLOCK_MIN";
    }
    if (isInCooldown(now, lastScaleInAt, monitoring.cooldownSeconds)) {
      return "BLOCK_COOLDOWN";
    }
    return "ALLOW";
  }

  return "ALLOW";
}</code></pre>

  <p><b>요약:</b> Now, scale-in/out min/max count determination is performed only based on the number of VMs registered in Prometheus Job,</p>
  <ul>
    <li>Scale-Out: currentVmCount &gt;= maxVms → Block</li>
    <li>스케일 인: currentVmCount &lt;= minVms → Block + Switch OFF + Create Silence</li>
    <li>Scale-In Switch: OFF when minimum VM count is reached, block webhooks via Alertmanager Silence</li>
    <li>Automatic Switch Recovery: Automatically ON when VM count increases, delete Silence</li>
    <li>Start cooldown when min/max is reached to prevent unnecessary execution from repeated alert notifications.</li>
    <li>Webhook Flow: Alertmanager → Backend (validation: switch, cooldown, VM count) → Jenkins</li>
  </ul>

  <!-- 7. Jenkins Pipeline -->
  <h2>7. Jenkins Autoscaling Pipeline Overview</h2>

  <h3>7.1 Jenkins Job Architecture</h3>
  <div class="box">
    <div class="mermaid">graph TB
  subgraph AlertManager[Alertmanager]
    AM[Alert Triggered]
  end
  
  subgraph Backend[Backend API]
    WEBHOOK[Webhook Endpoint<br/>/api/webhook/autoscale/:serviceName]
    CHECK[Cooldown and VM Count Check]
    JENKINS_TRIGGER[Jenkins Webhook Call]
  end
  
  subgraph Jenkins[Jenkins Server]
    JOB_OUT[plg-autoscale-out<br/>Scale-Out Pipeline]
    JOB_IN[plg-autoscale-in<br/>Scale-In Pipeline]
  end
  
  subgraph PipelineOut[Scale-Out Pipeline]
    STAGE1_OUT[1. Alert Parsing]
    STAGE2_OUT[2. Config Retrieval]
    STAGE3_OUT[3. IP Allocation]
    STAGE4_OUT[4. VM Clone]
    STAGE5_OUT[5. IP Configuration]
    STAGE6_OUT[6. F5 Registration]
    STAGE7_OUT[7. Prometheus Registration]
    STAGE8_OUT[8. Complete 웹훅]
  end
  
  subgraph PipelineIn[Scale-In Pipeline]
    STAGE1_IN[1. Alert Parsing]
    STAGE2_IN[2. Config Retrieval]
    STAGE3_IN[3. VM Selection]
    STAGE4_IN[4. F5 Removal]
    STAGE5_IN[5. Monitoring Removal]
    STAGE6_IN[6. Prometheus Removal]
    STAGE7_IN[7. VM Deletion]
    STAGE8_IN[8. Complete 웹훅]
  end
  
  AM -->|Webhook| WEBHOOK
  WEBHOOK --> CHECK[Validation: Switch/Cooldown/VM Count]
  CHECK -->|Pass| JENKINS_TRIGGER
  CHECK -->|Block| BLOCK[Block: 웹훅 무시]
  JENKINS_TRIGGER -->|Scale-Out| JOB_OUT
  JENKINS_TRIGGER -->|Scale-In| JOB_IN
  
  JOB_OUT --> STAGE1_OUT
  STAGE1_OUT --> STAGE2_OUT
  STAGE2_OUT --> STAGE3_OUT
  STAGE3_OUT --> STAGE4_OUT
  STAGE4_OUT --> STAGE5_OUT
  STAGE5_OUT --> STAGE6_OUT
  STAGE6_OUT --> STAGE7_OUT
  STAGE7_OUT --> STAGE8_OUT
  
  JOB_IN --> STAGE1_IN
  STAGE1_IN --> STAGE2_IN
  STAGE2_IN --> STAGE3_IN
  STAGE3_IN --> STAGE4_IN
  STAGE4_IN --> STAGE5_IN
  STAGE5_IN --> STAGE6_IN
  STAGE6_IN --> STAGE7_IN
  STAGE7_IN --> STAGE8_IN</div>
  </div>

  <h3>7.2 Job Configuration</h3>
  <ul>
    <li><code>plg-autoscale-out</code> : Scale-Out dedicated pipeline</li>
    <li><code>plg-autoscale-in</code> : Scale-In dedicated pipeline</li>
    <li>Service name (serviceName) is passed via Alertmanager Webhook labels/parameters to identify target AutoscalingConfig</li>
  </ul>

  <h3>7.3 Scale-Out Pipeline Stages (Summary)</h3>
  <ol>
    <li>Parse webhook payload (serviceName, alert information)</li>
    <li>Retrieve AutoscalingConfig from Backend</li>
    <li>Prometheus Job 타겟 조회 → Calculate currentVmCount</li>
    <li><code>decideScaleAction(config, state, "scale-out")</code> 호출 → 실행 Available 여부 판단</li>
    <li>If allowed
      <ul>
        <li>IP Pool에서 사용 Available한 IP 확보</li>
        <li>Clone VM from template using govc (name: <code>&lt;vmPrefix&gt;-YYYYMMDDHHmmss</code>)</li>
        <li>VM 부팅 후 SSH 접속 및 Netplan으로 IP Configuration</li>
        <li>Install Node Exporter / Promtail if needed</li>
        <li>F5 Add Pool Member</li>
        <li>Add Prometheus target</li>
      </ul>
    </li>
  </ol>

  <h3>7.4 Scale-In Pipeline Stages (Summary)</h3>
  <ol>
    <li>Parse webhook payload (serviceName, alert information)</li>
    <li>Retrieve AutoscalingConfig from Backend</li>
    <li>Prometheus Job 타겟 조회 → Calculate currentVmCount</li>
    <li><code>decideScaleAction(config, state, "scale-in")</code> 호출 → 실행 Available 여부 판단</li>
    <li>If allowed
      <ul>
        <li>Retrieve VM list from vCenter by vmPrefix</li>
        <li>Select Oldest VM</li>
        <li>Remove F5 Pool Member</li>
        <li>Remove Prometheus target</li>
        <li>VM OS End 후 vCenter에서 VM Deletion</li>
      </ul>
    </li>
  </ol>

  <!-- 8. Node Exporter / Promtail -->
  <h2>8. Node Exporter / Promtail Installation Overview</h2>
  <ul>
    <li>Retrieve VM and IP list from vCenter and display in UI</li>
    <li>User selects target VM and SSH settings (user/key)</li>
    <li>Backend executes Node Exporter / Promtail installation script via SSH</li>
    <li>On success, automatically register to Prometheus Job and Loki/Grafana</li>
  </ul>

  <!-- 9. Monitoring -->
  <h2>9. Monitoring and Dashboard</h2>
  <ul>
    <li>Grafana Dashboard
      <ul>
        <li>CPU/Memory Usage</li>
        <li>Current VM Count</li>
        <li>Scale-In/Out Event Timeline</li>
      </ul>
    </li>
    <li>Check scale trigger cause from Alertmanager alert list</li>
  </ul>

  <!-- 10. Events -->
  <h2>10. Autoscaling Event Management (Concept)</h2>
  <ul>
    <li>Scale-Out/Scale-In Execution 시 Backend로 이벤트 기록 요청</li>
    <li>Expected Fields
      <ul>
        <li>serviceName, action(scale-out | scale-in)</li>
        <li>vmNames, beforeCount, afterCount</li>
        <li>reason, timestamp</li>
      </ul>
    </li>
    <li>Future: Provide service-specific scale history query in UI</li>
  </ul>

  <!-- 11. Operations -->
  <h2>11. Operations Guide</h2>

  <h3>11.1 Initial Setup Procedure</h3>
  <ol>
    <li><b>Prepare Base VMs</b>
      <ul>
        <li>최소 2대 이상의 서비스 VM Creation (고정 IP)</li>
        <li>Install Node Exporter and register to Prometheus Job</li>
        <li>Register base VMs to F5 Pool and verify Health Check</li>
      </ul>
    </li>
    <li><b>Create Template</b>
      <ul>
        <li>UI에서 Create Template 메뉴 선택</li>
        <li>소스 VM Selection 및 템플릿 이름 지정</li>
        <li>vCenter에서 Create Template Complete 확인</li>
      </ul>
    </li>
    <li><b>Create Autoscaling Configuration</b>
      <ul>
        <li>Select service name, VM Prefix, template</li>
        <li>Monitoring settings: CPU/Memory thresholds, duration</li>
        <li>Scaling settings: Min/Max VM count, scale step</li>
        <li>Network settings: IP Pool range, Gateway, VLAN</li>
        <li>F5 settings: Pool name, VIP, Health Check Path</li>
      </ul>
    </li>
    <li><b>Activate Configuration</b>
      <ul>
        <li>Click activate button in configuration list</li>
        <li>Verify automatic creation of Prometheus Job, Alert Rule, Alertmanager Route</li>
        <li>Verify automatic creation of Jenkins Job</li>
      </ul>
    </li>
    <li><b>Test and Verify</b>
      <ul>
        <li>부하 생성 스크립트로 CPU/Memory Usage 증가</li>
        <li>Verify scale-out trigger</li>
        <li>VM Creation, F5 Registration, Prometheus Add Target 확인</li>
        <li>Verify scale-in trigger after load removal</li>
      </ul>
    </li>
  </ol>

  <h3>11.2 Daily Operations</h3>
  <ul>
    <li><b>Monitoring Dashboard 확인</b>
      <ul>
        <li>CPU/Memory Usage 그래프 모니터링</li>
        <li>Current VM Count 및 스케일 이벤트 확인</li>
        <li>Alert 상태 확인</li>
      </ul>
    </li>
    <li><b>스케일 이벤트 확인</b>
      <ul>
        <li>스케일아웃/인 이벤트 목록에서 최근 작업 확인</li>
        <li>Jenkins 빌드 로그 확인</li>
        <li>에러 발생 시 롤백 여부 확인</li>
      </ul>
    </li>
    <li><b>설정 변경</b>
      <ul>
        <li>임계값 조정 시 설정 수정 후 저장</li>
        <li>Prometheus Alert Rule 자동 업데이트 확인</li>
        <li>변경사항 적용 확인</li>
      </ul>
    </li>
  </ul>

  <h3>11.3 트러블슈팅</h3>
  <div class="box">
    <h4>문제: 스케일아웃이 발생하지 않음</h4>
    <ul>
      <li>Prometheus Alert Rule이 정상적으로 생성되었는지 확인</li>
      <li>Alertmanager Route가 올바르게 설정되었는지 확인</li>
      <li>쿨다운 기간이 지났는지 확인</li>
      <li>최대 VM 개수에 Reached하지 않았는지 확인</li>
      <li>Jenkins Job이 정상적으로 생성되었는지 확인</li>
    </ul>

    <h4>문제: 스케일인으로 VM이 계속 삭제됨</h4>
    <ul>
      <li>최소 VM 개수 설정 확인 (기본값: 2)</li>
      <li>스케일인 CPU/Memory 임계값이 너무 높은지 확인</li>
      <li>쿨다운 기간 확인</li>
      <li>Alertmanager가 반복 알림을 보내는지 확인</li>
    </ul>

    <h4>문제: VM Creation 후 F5에 등록되지 않음</h4>
    <ul>
      <li>Jenkins 빌드 로그에서 F5 Registration 단계 확인</li>
      <li>F5 Pool 이름 및 VIP Configuration 확인</li>
      <li>F5 인증 정보 확인</li>
      <li>Network 연결 확인</li>
    </ul>

    <h4>문제: Prometheus에 Target이 추가되지 않음</h4>
    <ul>
      <li>Prometheus Job 이름이 올바른지 확인</li>
      <li>VM IP와 포트(9100)가 올바른지 확인</li>
      <li>Prometheus 설정 파일이 올바르게 업데이트되었는지 확인</li>
      <li>Prometheus 컨테이너 재시작 여부 확인</li>
    </ul>
  </div>

  <!-- 12. 보안 -->
  <h2>12. 보안 및 권한 구조</h2>

  <h3>12.1 인증 및 권한 관리</h3>
  <ul>
    <li><b>vCenter 계정</b>
      <ul>
        <li>전용 서비스 계정 사용 (예: svc-auto)</li>
        <li>VM Creation/삭제, 템플릿 조회 권한만 부여</li>
        <li>관리자 권한 불필요</li>
      </ul>
    </li>
    <li><b>Jenkins 계정</b>
      <ul>
        <li>Webhook 트리거용 계정 (예: danacloud)</li>
        <li>Job 실행 권한만 부여</li>
        <li>Jenkins Credentials로 인증 정보 관리</li>
      </ul>
    </li>
    <li><b>F5 계정</b>
      <ul>
        <li>Add Pool Member/제거 권한만 부여</li>
        <li>관리자 권한 불필요</li>
        <li>Jenkins Credentials로 관리</li>
      </ul>
    </li>
    <li><b>PLG Stack 계정</b>
      <ul>
        <li>SSH 접근용 계정 (예: ubuntu)</li>
        <li>설정 파일 수정 권한만 부여</li>
        <li>SSH 키 기반 인증 사용</li>
      </ul>
    </li>
  </ul>

  <h3>12.2 데이터 보안</h3>
  <ul>
    <li><b>환경 변수 관리</b>
      <ul>
        <li>모든 민감 정보는 환경 변수로 관리</li>
        <li>코드에 하드코딩 금지</li>
        <li>.env 파일은 .gitignore에 추가</li>
      </ul>
    </li>
    <li><b>Network 보안</b>
      <ul>
        <li>Backend/Frontend는 사내망에서만 접근 Available</li>
        <li>VPN 또는 방화벽 규칙으로 외부 접근 Block</li>
        <li>서비스 간 통신은 내부 Network 사용</li>
      </ul>
    </li>
    <li><b>SSH 키 관리</b>
      <ul>
        <li>SSH 키는 pemkey 디렉토리에 저장</li>
        <li>파일 권한 600으로 설정</li>
        <li>Git에 커밋하지 않음</li>
      </ul>
    </li>
  </ul>

  <h3>12.3 보안 모범 사례</h3>
  <ul>
    <li>정기적인 보안 업데이트 및 패치 적용</li>
    <li>로그 모니터링 및 이상 징후 탐지</li>
    <li>정기적인 권한 검토 및 최소 권한 원칙 준수</li>
    <li>민감 정보 암호화 저장 (향후 개선)</li>
  </ul>

  <!-- 13. 성능 및 확장성 -->
  <h2>13. 성능 및 확장성</h2>

  <h3>13.1 성능 고려사항</h3>
  <ul>
    <li><b>쿨다운 메커니즘</b>
      <ul>
        <li>기본 쿨다운 기간: 5분 (300초)</li>
        <li>스케일아웃/인 각각 독립적인 Cooldown Management</li>
        <li>최소/Max Count Reached 시 자동 Start Cooldown</li>
        <li>Alertmanager 반복 알림 방지</li>
      </ul>
    </li>
    <li><b>VM Creation 시간</b>
      <ul>
        <li>템플릿 Clone: 약 1-2분</li>
        <li>VM 부팅 및 IP Configuration: 약 1-2분</li>
        <li>Health Check Wait: 약 30초</li>
        <li>F5 Registration 및 Prometheus 추가: 약 30초</li>
        <li>총 소요 시간: 약 3-5분</li>
      </ul>
    </li>
    <li><b>VM Deletion 시간</b>
      <ul>
        <li>F5 Removal: 약 10초</li>
        <li>Prometheus Removal: 약 10초</li>
        <li>VM Power Off: 약 30초</li>
        <li>VM Deletion: 약 1분</li>
        <li>총 소요 시간: 약 2분</li>
      </ul>
    </li>
  </ul>

  <h3>13.2 실제 스케일링 시나리오 예제</h3>
  <div class="box">
    <h4>시나리오 설정</h4>
    <ul>
      <li>초기 상태: VM 1번, VM 2번 운영 중 (최소 VM 개수: 2, 최대 VM 개수: 4)</li>
      <li>스케일아웃 CPU 임계값: 80%, 지속 시간: 1분</li>
      <li>스케일인 CPU 임계값: 30%, 지속 시간: 5분</li>
      <li>쿨다운 기간: 5분</li>
      <li>Alertmanager repeat_interval: 5분</li>
    </ul>

    <h4>스케일아웃 시나리오</h4>
    <div class="mermaid">gantt
    title 스케일아웃 타임라인
    dateFormat HH:mm
    axisFormat %H:%M
    
    section 초기 상태
    VM 1번 운영 :active, vm1, 00:00, 30m
    VM 2번 운영 :active, vm2, 00:00, 30m
    
    section 부하 증가
    CPU 80% 초과 :crit, load, 00:05, 1m
    Alert Triggered :milestone, alert1, 00:06, 0m
    Cooldown Check :done, cd1, 00:06, 1m
    
    section VM 3번 생성
    VM 3번 생성 시작 :active, vm3_create, 00:07, 5m
    VM 3번 서비스 투입 :done, vm3_ready, 00:12, 0m
    Start Cooldown (5분) :active, cooldown1, 00:12, 5m
    
    section VM 4번 생성
    CPU 여전히 80% 초과 :crit, load2, 00:12, 1m
    Alert 재발생 (5분 후) :milestone, alert2, 00:17, 0m
    쿨다운 End 확인 :done, cd2, 00:17, 1m
    VM 4번 생성 시작 :active, vm4_create, 00:18, 5m
    VM 4번 서비스 투입 :done, vm4_ready, 00:23, 0m
    Start Cooldown (5분) :active, cooldown2, 00:23, 5m</div>

    <p><strong>스케일아웃 프로세스:</strong></p>
    <ol>
      <li><strong>초기 상태:</strong> VM 1번, VM 2번 운영 중</li>
      <li><strong>부하 증가:</strong> CPU 사용률이 80% 초과하여 1분 이상 지속</li>
      <li><strong>Alert Triggered:</strong> Prometheus에서 Alert Firing → Alertmanager로 전달</li>
      <li><strong>VM 3번 생성:</strong> 
        <ul>
          <li>Cooldown Check Pass (초기 상태이므로 쿨다운 없음)</li>
          <li>Max VM Count Check Pass (현재 2개 < 최대 4개)</li>
          <li>Jenkins 파이프라인 실행: VM Creation, F5 Registration, Prometheus Registration (약 5분 소요)</li>
          <li>VM 3번 서비스 투입 Complete</li>
          <li>Start Cooldown (5분)</li>
        </ul>
      </li>
      <li><strong>VM 4번 생성:</strong>
        <ul>
          <li>부하가 여전히 높아 CPU 80% 초과 지속</li>
          <li>쿨다운 End 대기 (5분)</li>
          <li>Alertmanager가 5분 후 재전송 (repeat_interval)</li>
          <li>쿨다운 End 확인 후 VM 4번 생성 (약 5분 소요)</li>
          <li>VM 4번 서비스 투입 Complete</li>
          <li>최대 VM 개수(4개) Reached로 이후 스케일아웃 Block</li>
        </ul>
      </li>
    </ol>

    <h4>스케일인 시나리오</h4>
    <div class="mermaid">gantt
    title 스케일인 타임라인
    dateFormat HH:mm
    axisFormat %H:%M
    
    section Max Count Reached
    VM 1번 운영 :active, vm1_in, 00:00, 30m
    VM 2번 운영 :active, vm2_in, 00:00, 30m
    VM 3번 운영 :active, vm3_in, 00:00, 30m
    VM 4번 운영 :active, vm4_in, 00:00, 30m
    
    section 부하 감소
    전체 CPU 30% 이하 :done, low_load, 00:05, 5m
    Alert Triggered :milestone, alert_in1, 00:10, 0m
    Cooldown Check :done, cd_in1, 00:10, 1m
    
    section VM 4번 삭제
    VM 4번 삭제 시작 :active, vm4_del, 00:11, 2m
    VM 4번 삭제 Complete :milestone, vm4_done, 00:13, 0m
    Start Cooldown (5분) :active, cooldown_in1, 00:13, 5m
    
    section VM 3번 삭제
    CPU 여전히 30% 이하 :done, low_load2, 00:13, 5m
    Alert 재발생 (5분 후) :milestone, alert_in2, 00:18, 0m
    쿨다운 End 확인 :done, cd_in2, 00:18, 1m
    VM 3번 삭제 시작 :active, vm3_del, 00:19, 2m
    VM 3번 삭제 Complete :milestone, vm3_done, 00:21, 0m
    Start Cooldown (5분) :active, cooldown_in2, 00:21, 5m
    
    section 최소 개수 유지
    VM 1번 유지 :active, vm1_keep, 00:21, 10m
    VM 2번 유지 :active, vm2_keep, 00:21, 10m
    Min Count Reached로 스케일인 Block :crit, block, 00:21, 10m</div>

    <p><strong>스케일인 프로세스:</strong></p>
    <ol>
      <li><strong>Max Count Reached:</strong> VM 1번, 2번, 3번, 4번 모두 운영 중</li>
      <li><strong>부하 감소:</strong> 전체 CPU 사용률이 30% 이하로 5분 이상 지속</li>
      <li><strong>Alert Triggered:</strong> Prometheus에서 Alert Firing → Alertmanager로 전달</li>
      <li><strong>VM 4번 삭제 (가장 최신 VM):</strong>
        <ul>
          <li>Cooldown Check Pass</li>
          <li>Min VM Count Check Pass (현재 4개 > 최소 2개)</li>
          <li>Jenkins 파이프라인 실행: 가장 최신 VM(4번) 선택, F5 Removal, Prometheus Removal, VM Deletion (약 2분 소요)</li>
          <li>VM 4번 삭제 Complete</li>
          <li>Start Cooldown (5분)</li>
        </ul>
      </li>
      <li><strong>VM 3번 삭제:</strong>
        <ul>
          <li>부하가 여전히 낮아 CPU 30% 이하 지속</li>
          <li>쿨다운 End 대기 (5분)</li>
          <li>Alertmanager가 5분 후 재전송 (repeat_interval)</li>
          <li>쿨다운 End 확인 후 VM 3번 삭제 (약 2분 소요)</li>
          <li>VM 3번 삭제 Complete</li>
        </ul>
      </li>
      <li><strong>최소 개수 유지:</strong>
        <ul>
          <li>Current VM Count: 2개 (VM 1번, VM 2번)</li>
          <li>최소 VM 개수(2개)에 Reached하여 이후 스케일인 Block</li>
          <li>VM 1번과 VM 2번은 최소 개수로 유지됨</li>
        </ul>
      </li>
    </ol>

    <h4>타이밍 요약</h4>
    <table>
      <tr>
        <th>이벤트</th>
        <th>소요 시간</th>
        <th>설명</th>
      </tr>
      <tr>
        <td>VM Creation (스케일아웃)</td>
        <td>약 5분</td>
        <td>템플릿 Clone, IP Configuration, F5 Registration, Prometheus Registration</td>
      </tr>
      <tr>
        <td>VM Deletion (스케일인)</td>
        <td>약 2분</td>
        <td>F5 Removal, Prometheus Removal, VM Deletion</td>
      </tr>
      <tr>
        <td>쿨다운 기간</td>
        <td>5분</td>
        <td>스케일아웃/인 후 다음 액션까지 대기 시간</td>
      </tr>
      <tr>
        <td>Alertmanager 재전송</td>
        <td>5분</td>
        <td>Alert가 해결되지 않으면 5분마다 재전송</td>
      </tr>
      <tr>
        <td>스케일아웃: 3번 → 4번</td>
        <td>약 10분 후</td>
        <td>쿨다운(5분) + Alert 재전송(5분) = 최소 10분 후</td>
      </tr>
      <tr>
        <td>스케일인: 4번 삭제</td>
        <td>약 10분 후</td>
        <td>스케일인 조건 지속(5분) + Alert Triggered + 처리(2분) = 약 10분 후</td>
      </tr>
      <tr>
        <td>스케일인: 3번 삭제</td>
        <td>약 10분 후</td>
        <td>쿨다운(5분) + Alert 재전송(5분) + 처리(2분) = 약 10분 후</td>
      </tr>
    </table>
  </div>

  <h3>13.3 확장성</h3>
  <ul>
    <li><b>서비스별 독립 운영</b>
      <ul>
        <li>각 서비스는 독립적인 설정 및 Job 사용</li>
        <li>서비스 간 영향 없음</li>
        <li>동시에 여러 서비스 오토스케일링 Available</li>
      </ul>
    </li>
    <li><b>IP Pool Management</b>
      <ul>
        <li>서비스별 IP Pool 범위 지정</li>
        <li>IP 충돌 방지</li>
        <li>IP Pool 부족 시 스케일아웃 Block</li>
      </ul>
    </li>
    <li><b>리소스 제한</b>
      <ul>
        <li>최대 VM 개수로 리소스 사용량 제한</li>
        <li>vCenter 리소스 풀 활용</li>
        <li>Datastore 용량 모니터링</li>
      </ul>
    </li>
  </ul>

  <h3>13.4 모니터링 및 알림</h3>
  <div class="box">
    <h4>모니터링 항목</h4>
    <ul>
      <li><b>시스템 Metric</b>
        <ul>
          <li>CPU 사용률 (전체 및 인스턴스별)</li>
          <li>Memory 사용률 (전체 및 인스턴스별)</li>
          <li>Current VM Count</li>
          <li>스케일 이벤트 발생 횟수</li>
        </ul>
      </li>
      <li><b>인프라 Metric</b>
        <ul>
          <li>vCenter 연결 상태</li>
          <li>Prometheus Target 상태</li>
          <li>F5 Pool Member 상태</li>
          <li>Jenkins Job 실행 상태</li>
        </ul>
      </li>
      <li><b>알림</b>
        <ul>
          <li>스케일아웃/인 이벤트 알림</li>
          <li>에러 발생 알림</li>
          <li>최대/Min Count Reached 알림</li>
          <li>IP Pool 부족 알림</li>
        </ul>
      </li>
    </ul>
  </div>

  <!-- 14. 향후 고도화 -->
  <h2>14. 향후 고도화 방향</h2>

  <h3>14.1 고객사별 권한 분리</h3>
  <ul>
    <li>현재는 관리자만 모든 서비스에 대해 설정 Available</li>
    <li>향후에는 고객사(테넌트) 별로 접근 Available한 서비스와 오토스케일링 설정을 분리</li>
    <li>역할 기반 접근 제어(RBAC) 예:
      <ul>
        <li>GLOBAL_ADMIN, TENANT_ADMIN, TENANT_VIEWER 등</li>
      </ul>
    </li>
  </ul>

  <h3>14.2 고객사 전용 서버/인프라 제공</h3>
  <ul>
    <li>대형 고객사의 요구 시, Autoscaling Backend/Jenkins/PLG/F5 파티션을 전용 인스턴스로 제공</li>
    <li>각 고객사별로 min/maxVms, IP Pool, VLAN, 템플릿 및 모니터링을 완전히 분리 운영</li>
  </ul>

  <h3>14.3 고급 기능 아이디어</h3>
  <ul>
    <li><b>예측 스케일링</b>
      <ul>
        <li>AI/머신러닝 기반 Traffic 예측</li>
        <li>시간대별 패턴 분석</li>
        <li>사전 스케일아웃으로 응답 시간 단축</li>
      </ul>
    </li>
    <li><b>비용 최적화</b>
      <ul>
        <li>시간대/요일 기반 스케일링 정책</li>
        <li>비용 기반 스케일인 우선순위</li>
        <li>리소스 사용률 기반 최적화</li>
      </ul>
    </li>
    <li><b>하이브리드 오토스케일링</b>
      <ul>
        <li>Kubernetes(CAPV)와 연계</li>
        <li>클라우드와 온프레미스 통합 관리</li>
        <li>워크로드 특성에 따른 자동 배치</li>
      </ul>
    </li>
    <li><b>고급 모니터링</b>
      <ul>
        <li>애플리케이션 레벨 Metric 기반 스케일링</li>
        <li>JMX Metric 활용</li>
        <li>커스텀 Metric 지원</li>
      </ul>
    </li>
  </ul>

  <!-- 15. 요약 및 핵심 포인트 -->
  <h2>15. 요약 및 핵심 포인트</h2>

  <h3>15.1 핵심 아키텍처 원칙</h3>
  <div class="box">
    <ul>
      <li><b>비침투형 설계:</b> 기존 인프라(PLG Stack, Jenkins, F5, vSphere)를 최대한 재활용</li>
      <li><b>단일 기준 원칙:</b> Prometheus Job에 등록된 VM 개수만으로 최소/최대 개수 판단</li>
      <li><b>쿨다운 메커니즘:</b> 반복 알림 방지 및 리소스 보호</li>
      <li><b>서비스 독립성:</b> 각 서비스는 독립적으로 운영되며 서로 영향 없음</li>
      <li><b>자동화:</b> 설정부터 실행까지 전체 프로세스 자동화</li>
    </ul>
  </div>

  <h3>15.2 주요 특징</h3>
  <table>
    <tr>
      <th>항목</th>
      <th>설명</th>
    </tr>
    <tr>
      <td>템플릿 기반</td>
      <td>Golden Image 템플릿을 기반으로 빠른 VM Creation</td>
    </tr>
    <tr>
      <td>Metric 기반</td>
      <td>Prometheus Node Exporter Metric 기반 자동 판단</td>
    </tr>
    <tr>
      <td>웹훅 기반</td>
      <td>Alertmanager → Backend (Validation: Switch/Cooldown/VM Count) → Jenkins 웹훅 체인</td>
    </tr>
    <tr>
      <td>자동 등록</td>
      <td>VM Creation 시 F5 Pool 및 Prometheus Target 자동 등록</td>
    </tr>
    <tr>
      <td>안전한 삭제</td>
      <td>F5 Removal → Monitoring Removal → Prometheus Removal → VM Deletion 순서 보장</td>
    </tr>
  </table>

  <h3>15.3 성능 지표</h3>
  <table>
    <tr>
      <th>작업</th>
      <th>예상 소요 시간</th>
    </tr>
    <tr>
      <td>스케일아웃 (VM Creation)</td>
      <td>약 3-5분</td>
    </tr>
    <tr>
      <td>스케일인 (VM Deletion)</td>
      <td>약 2분</td>
    </tr>
    <tr>
      <td>쿨다운 기간</td>
      <td>기본 5분 (설정 Available)</td>
    </tr>
    <tr>
      <td>Alert Evaluation 주기</td>
      <td>5분 (Prometheus scrape interval)</td>
    </tr>
    <tr>
      <td>Alertmanager 재전송 주기</td>
      <td>5분 (repeat_interval)</td>
    </tr>
  </table>

  <h3>15.4 제한사항 및 주의사항</h3>
  <div class="warning">
    <ul>
      <li><b>IP Pool 범위:</b> IP Pool이 부족하면 스케일아웃이 Block됩니다. 충분한 IP 범위를 확보하세요.</li>
      <li><b>템플릿 준비:</b> 템플릿이 올바르게 준비되지 않으면 VM Creation이 실패할 수 있습니다.</li>
      <li><b>Network 연결:</b> VM Creation 후 Network 연결이 안정적이어야 F5 Health Check가 Pass합니다.</li>
      <li><b>쿨다운 기간:</b> 쿨다운 기간 중에는 스케일링이 발생하지 않으므로 급격한 부하 변화에 대응이 늦을 수 있습니다.</li>
      <li><b>최소 VM 개수:</b> 최소 VM 개수 이하로는 스케일인이 발생하지 않으므로 서비스 가용성이 보장됩니다.</li>
    </ul>
  </div>

  <!-- 16. 참고 자료 -->
  <h2>16. 참고 자료</h2>
  <ul>
    <li><a href="https://prometheus.io/docs/">Prometheus 공식 문서</a></li>
    <li><a href="https://prometheus.io/docs/alerting/latest/alertmanager/">Alertmanager 공식 문서</a></li>
    <li><a href="https://www.jenkins.io/doc/">Jenkins 공식 문서</a></li>
    <li><a href="https://github.com/vmware/govmomi">govc (vSphere CLI) 문서</a></li>
    <li><a href="https://clouddocs.f5.com/">F5 BIG-IP 문서</a></li>
  </ul>
  <ul>
    <li>AI/머신러닝 기반 예측 스케일링</li>
    <li>시간대/요일 기반 비용 최적화 정책</li>
    <li>Kubernetes(CAPV)와 연계한 하이브리드 오토스케일링</li>
  </ul>

</body>
</html>

