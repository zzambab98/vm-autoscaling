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
    /* Loading indicator until Mermaid diagram loads */
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
  <!-- Header Section -->
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


  <!-- Table of Contents -->
  <div class="box" style="margin-top: 32px; margin-bottom: 48px;">
    <h2 style="margin-top: 0; padding-bottom: 12px; border-bottom: 2px solid rgba(84, 107, 255, 0.2);">Table of Contents</h2>
    <ul style="list-style: none; padding-left: 0; margin: 0;">
      <li style="margin: 8px 0;"><a href="#section-1" style="color: #546bff; text-decoration: none; font-weight: 500;">1. Service Overview</a>
        <ul style="list-style: none; padding-left: 24px; margin-top: 4px;">
          <li style="margin: 4px 0;"><a href="#section-1-1" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">1.1 IXNode Autoscaling Definition</a></li>
          <li style="margin: 4px 0;"><a href="#section-1-2" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">1.2 Purpose</a></li>
          <li style="margin: 4px 0;"><a href="#section-1-3" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">1.3 Feature Summary</a></li>
          <li style="margin: 4px 0;"><a href="#section-1-4" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">1.4 Key Components</a></li>
          <li style="margin: 4px 0;"><a href="#section-1-5" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">1.5 Overall Architecture Diagram</a></li>
          <li style="margin: 4px 0;"><a href="#section-1-6" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">1.6 Data Flow Diagram</a></li>
          <li style="margin: 4px 0;"><a href="#section-1-7" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">1.7 Overall Operation Scenario Summary</a></li>
          <li style="margin: 4px 0;"><a href="#section-1-8" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">1.8 Component Interaction Diagram</a></li>
        </ul>
      </li>
      <li style="margin: 8px 0;"><a href="#section-2" style="color: #546bff; text-decoration: none; font-weight: 500;">2. Prerequisites and Preparation</a>
        <ul style="list-style: none; padding-left: 24px; margin-top: 4px;">
          <li style="margin: 4px 0;"><a href="#section-2-1" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">2.1 Infrastructure Preparation</a></li>
          <li style="margin: 4px 0;"><a href="#section-2-2" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">2.2 Server and Network</a></li>
        </ul>
      </li>
      <li style="margin: 8px 0;"><a href="#section-3" style="color: #546bff; text-decoration: none; font-weight: 500;">3. Overall Autoscaling Operation Structure</a>
        <ul style="list-style: none; padding-left: 24px; margin-top: 4px;">
          <li style="margin: 4px 0;"><a href="#section-3-1" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">3.1 Scale-Out Detailed Process</a></li>
          <li style="margin: 4px 0;"><a href="#section-3-2" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">3.2 Scale-In Detailed Process</a></li>
          <li style="margin: 4px 0;"><a href="#section-3-3" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">3.3 Scale-Out Sequence Diagram</a></li>
          <li style="margin: 4px 0;"><a href="#section-3-4" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">3.4 Scale-In Sequence Diagram</a></li>
        </ul>
      </li>
      <li style="margin: 8px 0;"><a href="#section-4" style="color: #546bff; text-decoration: none; font-weight: 500;">4. Data Model (TypeScript)</a>
        <ul style="list-style: none; padding-left: 24px; margin-top: 4px;">
          <li style="margin: 4px 0;"><a href="#section-4-1" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">4.1 Template Metadata</a></li>
          <li style="margin: 4px 0;"><a href="#section-4-2" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">4.2 Autoscaling Configuration</a></li>
        </ul>
      </li>
      <li style="margin: 8px 0;"><a href="#section-5" style="color: #546bff; text-decoration: none; font-weight: 500;">5. Scale-Out / Scale-In Conditions</a>
        <ul style="list-style: none; padding-left: 24px; margin-top: 4px;">
          <li style="margin: 4px 0;"><a href="#section-5-1" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">5.1 Scale-Out Conditions</a></li>
          <li style="margin: 4px 0;"><a href="#section-5-2" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">5.2 Scale-In Conditions</a></li>
        </ul>
      </li>
      <li style="margin: 8px 0;"><a href="#section-6" style="color: #546bff; text-decoration: none; font-weight: 500;">6. Scale-In/Out Count Decision Logic</a>
        <ul style="list-style: none; padding-left: 24px; margin-top: 4px;">
          <li style="margin: 4px 0;"><a href="#section-6-1" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">6.1 Issues Before Changes</a></li>
          <li style="margin: 4px 0;"><a href="#section-6-2" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">6.2 Policy After Changes</a></li>
          <li style="margin: 4px 0;"><a href="#section-6-3" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">6.3 Decision Logic Flowchart</a></li>
          <li style="margin: 4px 0;"><a href="#section-6-4" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">6.4 TypeScript Pseudocode</a></li>
        </ul>
      </li>
      <li style="margin: 8px 0;"><a href="#section-7" style="color: #546bff; text-decoration: none; font-weight: 500;">7. Jenkins Autoscaling Pipeline Overview</a>
        <ul style="list-style: none; padding-left: 24px; margin-top: 4px;">
          <li style="margin: 4px 0;"><a href="#section-7-1" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">7.1 Jenkins Job Architecture</a></li>
          <li style="margin: 4px 0;"><a href="#section-7-2" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">7.2 Job Configuration</a></li>
          <li style="margin: 4px 0;"><a href="#section-7-3" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">7.3 Scale-Out Pipeline Stages</a></li>
          <li style="margin: 4px 0;"><a href="#section-7-4" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">7.4 Scale-In Pipeline Stages</a></li>
        </ul>
      </li>
      <li style="margin: 8px 0;"><a href="#section-8" style="color: #546bff; text-decoration: none; font-weight: 500;">8. Node Exporter / Promtail Installation Overview</a></li>
      <li style="margin: 8px 0;"><a href="#section-9" style="color: #546bff; text-decoration: none; font-weight: 500;">9. Monitoring and Dashboard</a></li>
      <li style="margin: 8px 0;"><a href="#section-10" style="color: #546bff; text-decoration: none; font-weight: 500;">10. Autoscaling Event Management</a></li>
      <li style="margin: 8px 0;"><a href="#section-11" style="color: #546bff; text-decoration: none; font-weight: 500;">11. Operations Guide</a>
        <ul style="list-style: none; padding-left: 24px; margin-top: 4px;">
          <li style="margin: 4px 0;"><a href="#section-11-1" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">11.1 Initial Setup Procedure</a></li>
          <li style="margin: 4px 0;"><a href="#section-11-2" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">11.2 Daily Operations</a></li>
          <li style="margin: 4px 0;"><a href="#section-11-3" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">11.3 Troubleshooting</a></li>
        </ul>
      </li>
      <li style="margin: 8px 0;"><a href="#section-12" style="color: #546bff; text-decoration: none; font-weight: 500;">12. Security and Permission Structure</a>
        <ul style="list-style: none; padding-left: 24px; margin-top: 4px;">
          <li style="margin: 4px 0;"><a href="#section-12-1" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">12.1 Authentication and Permission Management</a></li>
          <li style="margin: 4px 0;"><a href="#section-12-2" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">12.2 Data Security</a></li>
          <li style="margin: 4px 0;"><a href="#section-12-3" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">12.3 Security Best Practices</a></li>
        </ul>
      </li>
      <li style="margin: 8px 0;"><a href="#section-13" style="color: #546bff; text-decoration: none; font-weight: 500;">13. Performance and Scalability</a>
        <ul style="list-style: none; padding-left: 24px; margin-top: 4px;">
          <li style="margin: 4px 0;"><a href="#section-13-1" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">13.1 Performance Considerations</a></li>
          <li style="margin: 4px 0;"><a href="#section-13-2" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">13.2 Real Scaling Scenario Example</a></li>
          <li style="margin: 4px 0;"><a href="#section-13-3" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">13.3 Scalability</a></li>
          <li style="margin: 4px 0;"><a href="#section-13-4" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">13.4 Monitoring and Alerts</a></li>
        </ul>
      </li>
      <li style="margin: 8px 0;"><a href="#section-14" style="color: #546bff; text-decoration: none; font-weight: 500;">14. Future Enhancement Directions</a>
        <ul style="list-style: none; padding-left: 24px; margin-top: 4px;">
          <li style="margin: 4px 0;"><a href="#section-14-1" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">14.1 Tenant-Based Permission Separation</a></li>
          <li style="margin: 4px 0;"><a href="#section-14-2" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">14.2 Tenant-Dedicated Server/Infrastructure</a></li>
          <li style="margin: 4px 0;"><a href="#section-14-3" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">14.3 Advanced Feature Ideas</a></li>
        </ul>
      </li>
      <li style="margin: 8px 0;"><a href="#section-15" style="color: #546bff; text-decoration: none; font-weight: 500;">15. Summary and Key Points</a>
        <ul style="list-style: none; padding-left: 24px; margin-top: 4px;">
          <li style="margin: 4px 0;"><a href="#section-15-1" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">15.1 Core Architecture Principles</a></li>
          <li style="margin: 4px 0;"><a href="#section-15-2" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">15.2 Key Features</a></li>
          <li style="margin: 4px 0;"><a href="#section-15-3" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">15.3 Performance Metrics</a></li>
          <li style="margin: 4px 0;"><a href="#section-15-4" style="color: rgba(13, 21, 56, 0.7); text-decoration: none; font-size: 14px;">15.4 Limitations and Considerations</a></li>
        </ul>
      </li>
      <li style="margin: 8px 0;"><a href="#section-16" style="color: #546bff; text-decoration: none; font-weight: 500;">16. References</a></li>
    </ul>
  </div>

  <!-- 1. Service Overview -->
  <h2 id="section-1">1. Service Overview</h2>

  <h3 id="section-1-1">1.1 IXNode Autoscaling Definition</h3>
  <p>IXNode Autoscaling operates by combining the following elements:</p>
  <ul>
    <li>VM templates and cloning via vSphere (vCenter)</li>
    <li>Metric collection and alerting via PLG Stack (Prometheus, Alertmanager, Grafana)</li>
    <li>Automation of VM creation/deletion tasks via Jenkins pipelines</li>
    <li>Traffic distribution and health checks via F5 LTM Pool/VIP</li>
  </ul>

  <h3 id="section-1-2">1.2 Purpose</h3>
  <ul>
    <li>Ensure service availability through automatic scaling when load increases</li>
    <li>Optimize costs through automatic reduction when load decreases</li>
    <li>Eliminate repetitive VM creation/deletion and F5 registration tasks for DevOps/operations teams</li>
    <li>Non-intrusive architecture that maximizes reuse of existing infrastructure (PLG, F5, Jenkins, vSphere)</li>
  </ul>

  <h3 id="section-1-3">1.3 Feature Summary</h3>
  <ul>
    <li>Template-based automatic VM creation and deletion</li>
    <li>Automatic creation and deletion of Prometheus Jobs / Alert Rules / Alertmanager Routes</li>
    <li>Automatic creation and execution of Scale-Out / Scale-In Jenkins pipelines</li>
    <li>Automatic F5 Pool Member registration/removal</li>
    <li>Node Exporter / Promtail installation and integration with Prometheus, Loki, Grafana</li>
    <li>Scale event logging and notifications</li>
  </ul>

  <h3 id="section-1-4">1.4 Key Components</h3>
  <ul>
    <li><b>Frontend</b> (React): Template management, autoscaling configuration, Node Exporter/Promtail installation UI</li>
    <li><b>Backend</b> (Node.js / TypeScript): Configuration storage, validation, vCenter/PLG/Jenkins/F5 integration</li>
    <li><b>PLG Stack</b>: Prometheus, Alertmanager, Grafana</li>
    <li><b>Jenkins</b>: Autoscale-Out / Autoscale-In pipeline execution</li>
    <li><b>F5 BIG-IP LTM</b>: VIP / Pool / Health Monitor</li>
    <li><b>vSphere (vCenter + ESXi)</b>: VM and template management</li>
  </ul>

  <h3 id="section-1-5">1.5 Overall Architecture Diagram</h3>
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

  <h3 id="section-1-6">1.6 Data Flow Diagram</h3>
  <div class="box">
    <div class="mermaid">flowchart TD
  START([Config Creation/Activation]) --> CONFIG[Backend: Config Storage]
  CONFIG --> PROM_CREATE[Prometheus: Job Creation]
  CONFIG --> ALERT_CREATE[Prometheus: Alert Rule Creation]
  CONFIG --> AM_CREATE[Alertmanager: Route/Webhook Creation]
  CONFIG --> JENKINS_CREATE[Jenkins: Job Creation]

  PROM_CREATE --> METRIC[Prometheus: Start Metric Collection]
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
  CHECK_MAX -->|Not Reached| JENKINS_OUT[Jenkins: Scale-Out Execution]

  WEBHOOK_IN --> CHECK_SWITCH{Scale-In Switch Check}
  CHECK_SWITCH -->|OFF| BLOCK_SWITCH[Block + Create Silence]
  CHECK_SWITCH -->|ON| CHECK_COOLDOWN_IN{Cooldown Check}
  CHECK_COOLDOWN_IN -->|In Cooldown| BLOCK_IN[Block]
  CHECK_COOLDOWN_IN -->|Available| CHECK_MIN{Min VM Count Check}
  CHECK_MIN -->|Reached| BLOCK_MIN[Block + Switch OFF + Create Silence]
  CHECK_MIN -->|Not Reached| JENKINS_IN[Jenkins: Scale-In Execution]

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

  <h3 id="section-1-7">1.7 Overall Operation Scenario Summary</h3>
  <ol>
    <li>Operator creates templates and creates/activates autoscaling configuration in the UI.</li>
    <li>Backend automatically creates Prometheus Jobs/Alert Rules, Alertmanager Routes, and Jenkins Jobs.</li>
    <li>Prometheus collects Node Exporter metrics and sends alerts to Alertmanager when thresholds are exceeded.</li>
    <li>Alertmanager calls backend webhook (backend checks cooldown and min/max VM count).</li>
    <li>Backend calls Jenkins Webhook when validation passes.</li>
    <li>Jenkins pipeline performs VM creation/deletion, F5 pool registration/removal, and Prometheus target addition/removal.</li>
    <li>Controls min/max VM count based on the number of VM targets registered in Prometheus Jobs.</li>
  </ol>

  <h3 id="section-1-8">1.8 Component Interaction Diagram</h3>
  <div class="box">
    <div class="mermaid">graph TB
  subgraph SetupPhase[Setup Phase]
    UI1[UI: Config Creation] --> BE1[Backend: Config Storage]
    BE1 --> PM1[Prometheus: Job Creation]
    BE1 --> AR1[Prometheus: Alert Rule Creation]
    BE1 --> AM1[Alertmanager: Route Creation]
    BE1 --> JN1[Jenkins: Job Creation]
  end

  subgraph MonitoringPhase[Monitoring Phase]
    VM_M[VM: Node Exporter] -->|Metric| PM_M[Prometheus: Collection]
    PM_M -->|Evaluation| AR_M[Alert Rule: Evaluation]
    AR_M -->|Alert Firing| AM_M[Alertmanager: Reception]
  end

  subgraph DecisionPhase[Decision Phase]
    AM_M -->|Webhook| BE_D[Backend: Webhook Reception]
    BE_D --> CD[Cooldown Check]
    BE_D --> CNT[VM Count Check]
    CD -->|Pass| CNT
    CNT -->|Pass| JN_D[Jenkins: Trigger]
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
  <h2 id="section-2">2. Prerequisites and Preparation</h2>

  <h3 id="section-2-1">2.1 Infrastructure Preparation</h3>
  <ul>
    <li>vSphere (vCenter) accessible, govc CLI available</li>
    <li>F5 BIG-IP LTM configured with Pool, VIP, and HTTP Health Monitor for target service</li>
    <li>PLG Stack (Prometheus, Alertmanager, Grafana) running</li>
  </ul>

  <h3 id="section-2-2">2.2 Server and Network</h3>
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
  <h2 id="section-3">3. Overall Autoscaling Operation Structure</h2>

  <h3 id="section-3-1">3.1 Scale-Out Detailed Process</h3>
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

  <h3 id="section-3-2">3.2 Scale-In Detailed Process</h3>
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
  SELECT_VM --> F5_REMOVE[F5: Remove Pool Member]
  F5_REMOVE --> F5_NODE[F5: Node Deletion]
  F5_NODE --> MONITOR_REMOVE[Monitoring Removal<br/>Node Exporter/Promtail]
  MONITOR_REMOVE --> PROM_REMOVE[Prometheus: Remove Target]
  PROM_REMOVE --> VM_POWER_OFF[vCenter: VM Power Off]
  VM_POWER_OFF --> VM_DELETE[vCenter: VM Deletion]
  VM_DELETE --> WEBHOOK_CALLBACK[Backend: VM Deletion Complete Webhook]
  WEBHOOK_CALLBACK --> CHECK_VM_COUNT{Check Current VM Count}
  CHECK_VM_COUNT -->|currentVmCount <= minVms| SWITCH_OFF[Scale-In Switch OFF]
  SWITCH_OFF --> SILENCE_CREATE[Create Alertmanager Silence<br/>Block webhooks for 30 minutes]
  CHECK_VM_COUNT -->|currentVmCount > minVms| SWITCH_ON[Scale-In Switch ON<br/>Delete Silence]
  SILENCE_CREATE --> COOLDOWN_START[Start Cooldown]
  SWITCH_ON --> COOLDOWN_START
  COOLDOWN_START --> END([Complete])
  
  REJECT1 --> END
  REJECT2 --> END</div>
  </div>

  <h3 id="section-3-3">3.3 Scale-Out Sequence Diagram</h3>
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

  JN->>BE: Retrieve AutoscalingConfig
  BE-->>JN: Config Returned (minVms, maxVms, etc.)

  JN->>PM: Retrieve Prometheus Target
  JN->>JN: Calculate currentVmCount
  JN->>JN: decideScaleAction(config, state, "scale-out")
  JN->>VC: Template Clone &amp; VM Creation
  JN->>VM: Netplan IP Configuration and Health Check
  JN->>F5: Add Pool Member
  JN->>PM: Add Target</div>
  </div>

  <h3 id="section-3-4">3.4 Scale-In Sequence Diagram</h3>
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

  JN->>BE: Retrieve AutoscalingConfig
  BE-->>JN: Config Returned

  JN->>PM: Retrieve Prometheus Target
  JN->>JN: Calculate currentVmCount
  JN->>JN: decideScaleAction(config, state, "scale-in")

  JN->>VC: VM List Retrieval by vmPrefix
  JN->>JN: Select Oldest VM
  JN->>F5: Remove Pool Member
  JN->>PM: Remove Target
  JN->>VC: VM Deletion</div>
  </div>

  <!-- 4. Data Model -->
  <h2 id="section-4">4. Data Model (TypeScript)</h2>

  <h3 id="section-4-1">4.1 Template Metadata</h3>
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

  <h3 id="section-4-2">4.2 Autoscaling Configuration</h3>
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
  <h2 id="section-5">5. Scale-Out / Scale-In Conditions</h2>

  <h3 id="section-5-1">5.1 Scale-Out Conditions</h3>
  <div class="info">
    <p><strong>Note:</strong> Scale-out conditions are triggered when the <strong>maximum value among all instances</strong> exceeds the threshold using the <code>max()</code> function. That is, scale-out occurs if any instance has high usage.</p>
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

  <h3 id="section-5-2">5.2 Scale-In Conditions</h3>
  <div class="info">
    <p><strong>Note:</strong> Scale-in conditions are triggered when the <strong>maximum value of all instances</strong> is below the threshold using the <code>max()</code> function. That is, scale-in occurs only when all VMs have low usage.</p>
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
    <p><strong>Description:</strong> Scale-in occurs only when the maximum CPU/Memory usage of all instances is below the threshold using the <code>max()</code> function. That is, scale-in is triggered only when all VMs have low usage.</p>
  </div>

  <!-- 6. Scale-In/Out Decision Logic (Changes) -->
  <h2 id="section-6">6. Scale-In/Out Count Decision Logic (Including Changes)</h2>

  <h3 id="section-6-1">6.1 Issues Before Changes</h3>
  <ul>
    <li>When scaling in, filtering VM lists from multiple sources (vCenter, F5, Prometheus) with complex logic and then comparing counts</li>
    <li>When information from different sources is inconsistent, min/max VM count determination may differ, making the criteria inconsistent</li>
  </ul>

  <h3 id="section-6-2">6.2 Policy After Changes</h3>
  <ul>
    <li><b>Single Criteria:</b> Both scale-in and scale-out are determined based on the <b>number of VM targets registered in Prometheus Job</b> (currentVmCount)</li>
    <li><b>Scale-Out Block Condition:</b> currentVmCount &gt;= maxVms → Scale-Out Block</li>
    <li><b>Scale-In Block Condition:</b> currentVmCount &lt;= minVms → Scale-In Block</li>
    <li><b>Scale-In Switch Method:</b> When minimum VM count is reached, turn scale-in switch OFF and create Alertmanager Silence to block webhooks</li>
    <li><b>Silence Creation on VM Deletion:</b> When VM deletion complete webhook is received, check current VM count and create Silence if minimum count is reached (double protection)</li>
    <li><b>Automatic Switch Recovery:</b> When VM count reaches above minimum, automatically turn switch ON and delete Silence</li>
    <li><b>Start Cooldown:</b> Start cooldown when min/max count is reached to prevent pipeline overload from Alertmanager repeated alerts</li>
    <li><b>Logic Simplification:</b> Remove unnecessary duplicate checks, determine min/max count only from Prometheus Job targets</li>
    <li><b>Webhook Flow:</b> Alertmanager → Backend (validation) → Jenkins (execution)</li>
  </ul>

  <h3 id="section-6-3">6.3 Decision Logic Flowchart</h3>
  <div class="box">
    <div class="mermaid">flowchart TD
  START([Webhook Received]) --> TYPE{Scale Type}
  TYPE -->|Scale-Out| CHECK_COOLDOWN_OUT{Cooldown Check}
  TYPE -->|Scale-In| CHECK_COOLDOWN_IN{Cooldown Check}
  
  CHECK_COOLDOWN_OUT -->|In Cooldown| REJECT_COOLDOWN_OUT[Block: Cooldown]
  CHECK_COOLDOWN_OUT -->|Available| GET_COUNT_OUT[Retrieve Prometheus Target Count]
  GET_COUNT_OUT --> CHECK_MAX{currentVmCount >= maxVms?}
  CHECK_MAX -->|Yes| REJECT_MAX[Block: Max Count Reached<br/>Start Cooldown]
  CHECK_MAX -->|No| ALLOW_OUT[Allow: Scale-Out Execution]
  
  CHECK_COOLDOWN_IN -->|In Cooldown| REJECT_COOLDOWN_IN[Block: Cooldown]
  CHECK_COOLDOWN_IN -->|Available| CHECK_SWITCH_IN{Scale-In Switch Check}
  CHECK_SWITCH_IN -->|OFF| REJECT_SWITCH[Block: Switch OFF<br/>Create Silence]
  CHECK_SWITCH_IN -->|ON| GET_COUNT_IN[Retrieve Prometheus Target Count]
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

  <h3 id="section-6-4">6.4 TypeScript Pseudocode</h3>
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
      // Max count reached → Scale-Out Block + Start Cooldown
      return "BLOCK_MAX";
    }
    if (isInCooldown(now, lastScaleOutAt, monitoring.cooldownSeconds)) {
      return "BLOCK_COOLDOWN";
    }
    return "ALLOW";
  }

  if (alertType === "scale-in") {
    if (currentVmCount &lt;= minVms) {
      // Min count reached → Scale-In Block + Start Cooldown
      return "BLOCK_MIN";
    }
    if (isInCooldown(now, lastScaleInAt, monitoring.cooldownSeconds)) {
      return "BLOCK_COOLDOWN";
    }
    return "ALLOW";
  }

  return "ALLOW";
}</code></pre>

  <p><b>Summary:</b> Now, scale-in/out min/max count determination is performed only based on the number of VMs registered in Prometheus Job,</p>
  <ul>
    <li>Scale-Out: currentVmCount &gt;= maxVms → Block</li>
    <li>Scale-In: currentVmCount &lt;= minVms → Block + Switch OFF + Create Silence</li>
    <li>Scale-In Switch: OFF when minimum VM count is reached, block webhooks via Alertmanager Silence</li>
    <li>On VM Deletion Complete: When VM deletion webhook is received, check VM count and create Silence if minimum count is reached (double protection)</li>
    <li>Automatic Switch Recovery: Automatically ON when VM count increases, delete Silence</li>
    <li>Start cooldown when min/max is reached to prevent unnecessary execution from repeated alert notifications.</li>
    <li>Webhook Flow: Alertmanager → Backend (validation: switch, cooldown, VM count) → Jenkins</li>
  </ul>

  <!-- 7. Jenkins Pipeline -->
  <h2 id="section-7">7. Jenkins Autoscaling Pipeline Overview</h2>

  <h3 id="section-7-1">7.1 Jenkins Job Architecture</h3>
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
    STAGE8_OUT[8. Complete Webhook]
  end
  
  subgraph PipelineIn[Scale-In Pipeline]
    STAGE1_IN[1. Alert Parsing]
    STAGE2_IN[2. Config Retrieval]
    STAGE3_IN[3. VM Selection]
    STAGE4_IN[4. F5 Removal]
    STAGE5_IN[5. Monitoring Removal]
    STAGE6_IN[6. Prometheus Removal]
    STAGE7_IN[7. VM Deletion]
    STAGE8_IN[8. Complete Webhook]
  end
  
  AM -->|Webhook| WEBHOOK
  WEBHOOK --> CHECK[Validation: Switch/Cooldown/VM Count]
  CHECK -->|Pass| JENKINS_TRIGGER
  CHECK -->|Block| BLOCK[Block: Ignore Webhook]
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

  <h3 id="section-7-2">7.2 Job Configuration</h3>
  <ul>
    <li><code>plg-autoscale-out</code> : Scale-Out dedicated pipeline</li>
    <li><code>plg-autoscale-in</code> : Scale-In dedicated pipeline</li>
    <li>Service name (serviceName) is passed via Alertmanager Webhook labels/parameters to identify target AutoscalingConfig</li>
  </ul>

  <h3 id="section-7-3">7.3 Scale-Out Pipeline Stages (Summary)</h3>
  <ol>
    <li>Parse webhook payload (serviceName, alert information)</li>
    <li>Retrieve AutoscalingConfig from Backend</li>
    <li>Retrieve Prometheus Job targets → Calculate currentVmCount</li>
    <li><code>decideScaleAction(config, state, "scale-out")</code> Call → Determine if execution is available</li>
    <li>If allowed
      <ul>
        <li>Acquire available IP from IP Pool</li>
        <li>Clone VM from template using govc (name: <code>&lt;vmPrefix&gt;-YYYYMMDDHHmmss</code>)</li>
        <li>After VM boot, SSH access and configure IP using Netplan</li>
        <li>Install Node Exporter / Promtail if needed</li>
        <li>F5 Add Pool Member</li>
        <li>Add Prometheus target</li>
      </ul>
    </li>
  </ol>

  <h3 id="section-7-4">7.4 Scale-In Pipeline Stages (Summary)</h3>
  <ol>
    <li>Parse webhook payload (serviceName, alert information)</li>
    <li>Retrieve AutoscalingConfig from Backend</li>
    <li>Retrieve Prometheus Job targets → Calculate currentVmCount</li>
    <li><code>decideScaleAction(config, state, "scale-in")</code> Call → Determine if execution is available</li>
    <li>If allowed
      <ul>
        <li>Retrieve VM list from vCenter by vmPrefix</li>
        <li>Select Oldest VM</li>
        <li>Remove F5 Pool Member</li>
        <li>Remove Prometheus target</li>
        <li>Shut down VM OS and delete VM from vCenter</li>
      </ul>
    </li>
  </ol>

  <!-- 8. Node Exporter / Promtail -->
  <h2 id="section-8">8. Node Exporter / Promtail Installation Overview</h2>
  <ul>
    <li>Retrieve VM and IP list from vCenter and display in UI</li>
    <li>User selects target VM and SSH settings (user/key)</li>
    <li>Backend executes Node Exporter / Promtail installation script via SSH</li>
    <li>On success, automatically register to Prometheus Job and Loki/Grafana</li>
  </ul>

  <!-- 9. Monitoring -->
  <h2 id="section-9">9. Monitoring and Dashboard</h2>
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
  <h2 id="section-10">10. Autoscaling Event Management (Concept)</h2>
  <ul>
    <li>Request event logging to Backend when Scale-Out/Scale-In is executed</li>
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
  <h2 id="section-11">11. Operations Guide</h2>

  <h3 id="section-11-1">11.1 Initial Setup Procedure</h3>
  <ol>
    <li><b>Prepare Base VMs</b>
      <ul>
        <li>Create at least 2 service VMs (static IP)</li>
        <li>Install Node Exporter and register to Prometheus Job</li>
        <li>Register base VMs to F5 Pool and verify Health Check</li>
      </ul>
    </li>
    <li><b>Create Template</b>
      <ul>
        <li>Select Create Template menu in UI</li>
        <li>Select source VM and specify template name</li>
        <li>Verify template creation completion in vCenter</li>
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
        <li>Increase CPU/Memory usage with load generation script</li>
        <li>Verify scale-out trigger</li>
        <li>Verify VM creation, F5 registration, Prometheus target addition</li>
        <li>Verify scale-in trigger after load removal</li>
      </ul>
    </li>
  </ol>

  <h3 id="section-11-2">11.2 Daily Operations</h3>
  <ul>
    <li><b>Check Monitoring Dashboard</b>
      <ul>
        <li>Monitor CPU/Memory usage graphs</li>
        <li>Check current VM count and scale events</li>
        <li>Check alert status</li>
      </ul>
    </li>
    <li><b>Check Scale Events</b>
      <ul>
        <li>Check recent operations from scale-out/in event list</li>
        <li>Check Jenkins build logs</li>
        <li>Check if rollback is needed when errors occur</li>
      </ul>
    </li>
    <li><b>Configuration Changes</b>
      <ul>
        <li>Modify and save configuration when adjusting thresholds</li>
        <li>Verify automatic Prometheus Alert Rule update</li>
        <li>Verify changes are applied</li>
      </ul>
    </li>
  </ul>

  <h3 id="section-11-3">11.3 Troubleshooting</h3>
  <div class="box">
    <h4>Issue: Scale-Out Not Occurring</h4>
    <ul>
      <li>Verify Prometheus Alert Rule is created correctly</li>
      <li>Verify Alertmanager Route is configured correctly</li>
      <li>Verify cooldown period has passed</li>
      <li>Verify max VM count is not reached</li>
      <li>Verify Jenkins Job is created correctly</li>
    </ul>

    <h4>Issue: VMs Continuously Deleted by Scale-In</h4>
    <ul>
      <li>Check minimum VM count setting (default: 2)</li>
      <li>Check if scale-in CPU/Memory threshold is too high</li>
      <li>Check cooldown period</li>
      <li>Check if Alertmanager is sending repeated alerts</li>
    </ul>

    <h4>Issue: VM Not Registered to F5 After Creation</h4>
    <ul>
      <li>Check F5 registration step in Jenkins build logs</li>
      <li>Check F5 Pool name and VIP configuration</li>
      <li>Check F5 credentials</li>
      <li>Check network connectivity</li>
    </ul>

    <h4>Issue: Target Not Added to Prometheus</h4>
    <ul>
      <li>Verify Prometheus Job name is correct</li>
      <li>Verify VM IP and port (9100) are correct</li>
      <li>Verify Prometheus configuration file is updated correctly</li>
      <li>Check if Prometheus container needs restart</li>
    </ul>
  </div>

  <!-- 12. Security -->
  <h2 id="section-12">12. Security and Permission Structure</h2>

  <h3 id="section-12-1">12.1 Authentication and Permission Management</h3>
  <ul>
    <li><b>vCenter Account</b>
      <ul>
        <li>Use dedicated service account (e.g., svc-auto)</li>
        <li>Grant only VM creation/deletion and template query permissions</li>
        <li>Administrator privileges not required</li>
      </ul>
    </li>
    <li><b>Jenkins Account</b>
      <ul>
        <li>Account for webhook triggers (e.g., danacloud)</li>
        <li>Grant only job execution permissions</li>
        <li>Manage credentials using Jenkins Credentials</li>
      </ul>
    </li>
    <li><b>F5 Account</b>
      <ul>
        <li>Grant only pool member add/remove permissions</li>
        <li>Administrator privileges not required</li>
        <li>Manage using Jenkins Credentials</li>
      </ul>
    </li>
    <li><b>PLG Stack Account</b>
      <ul>
        <li>Account for SSH access (e.g., ubuntu)</li>
        <li>Grant only configuration file modification permissions</li>
        <li>Use SSH key-based authentication</li>
      </ul>
    </li>
  </ul>

  <h3 id="section-12-2">12.2 Data Security</h3>
  <ul>
    <li><b>Environment Variable Management</b>
      <ul>
        <li>Manage all sensitive information as environment variables</li>
        <li>No hardcoding in code</li>
        <li>Add .env file to .gitignore</li>
      </ul>
    </li>
    <li><b>Network Security</b>
      <ul>
        <li>Backend/Frontend accessible only from internal network</li>
        <li>Block external access via VPN or firewall rules</li>
        <li>Use internal network for inter-service communication</li>
      </ul>
    </li>
    <li><b>SSH Key Management</b>
      <ul>
        <li>Store SSH keys in pemkey directory</li>
        <li>Set file permissions to 600</li>
        <li>Do not commit to Git</li>
      </ul>
    </li>
  </ul>

  <h3 id="section-12-3">12.3 Security Best Practices</h3>
  <ul>
    <li>Regular security updates and patch application</li>
    <li>Log monitoring and anomaly detection</li>
    <li>Regular permission review and adherence to principle of least privilege</li>
    <li>Encrypted storage of sensitive information (future improvement)</li>
  </ul>

  <!-- 13. Performance and Scalability -->
  <h2 id="section-13">13. Performance and Scalability</h2>

  <h3 id="section-13-1">13.1 Performance Considerations</h3>
  <ul>
    <li><b>Cooldown Mechanism</b>
      <ul>
        <li>Default cooldown period: 5 minutes (300 seconds)</li>
        <li>Independent cooldown management for scale-out/in</li>
        <li>Automatically start cooldown when min/max count is reached</li>
        <li>Prevent Alertmanager repeated alerts</li>
      </ul>
    </li>
    <li><b>VM Creation Time</b>
      <ul>
        <li>Template clone: approximately 1-2 minutes</li>
        <li>VM boot and IP configuration: approximately 1-2 minutes</li>
        <li>Health check wait: approximately 30 seconds</li>
        <li>F5 registration and Prometheus addition: approximately 30 seconds</li>
        <li>Total time: approximately 3-5 minutes</li>
      </ul>
    </li>
    <li><b>VM Deletion Time</b>
      <ul>
        <li>F5 removal: approximately 10 seconds</li>
        <li>Prometheus removal: approximately 10 seconds</li>
        <li>VM power off: approximately 30 seconds</li>
        <li>VM deletion: approximately 1 minute</li>
        <li>Total time: approximately 2 minutes</li>
      </ul>
    </li>
  </ul>

  <h3 id="section-13-2">13.2 Real Scaling Scenario Example</h3>
  <div class="box">
    <h4>Scenario Setup</h4>
    <ul>
      <li>Initial state: VM 1 and VM 2 running (min VM count: 2, max VM count: 4)</li>
      <li>Scale-out CPU threshold: 80%, duration: 1 minute</li>
      <li>Scale-in CPU threshold: 30%, duration: 5 minutes</li>
      <li>Cooldown period: 5 minutes</li>
      <li>Alertmanager repeat_interval: 5 minutes</li>
    </ul>

    <h4>Scale-Out Scenario</h4>
    <div class="mermaid">gantt
    title Scale-Out Timeline
    dateFormat HH:mm
    axisFormat %H:%M
    
    section Initial State
    VM 1 Running :active, vm1, 00:00, 30m
    VM 2 Running :active, vm2, 00:00, 30m
    
    section Load Increase
    CPU Exceeds 80% :crit, load, 00:05, 1m
    Alert Triggered :milestone, alert1, 00:06, 0m
    Cooldown Check :done, cd1, 00:06, 1m
    
    section VM 3 Creation
    VM 3 Creation Started :active, vm3_create, 00:07, 5m
    VM 3 Service Deployment :done, vm3_ready, 00:12, 0m
    Start Cooldown (5 minutes) :active, cooldown1, 00:12, 5m
    
    section VM 4 Creation
    CPU Still Exceeds 80% :crit, load2, 00:12, 1m
    Alert Re-triggered (after 5 minutes) :milestone, alert2, 00:17, 0m
    Cooldown End Verified :done, cd2, 00:17, 1m
    VM 4 Creation Started :active, vm4_create, 00:18, 5m
    VM 4 Service Deployment :done, vm4_ready, 00:23, 0m
    Start Cooldown (5 minutes) :active, cooldown2, 00:23, 5m</div>

    <p><strong>Scale-Out Process:</strong></p>
    <ol>
      <li><strong>Initial State:</strong> VM 1 and VM 2 running</li>
      <li><strong>Load Increase:</strong> CPU usage exceeds 80% for more than 1 minute</li>
      <li><strong>Alert Triggered:</strong> Alert firing from Prometheus → sent to Alertmanager</li>
      <li><strong>VM 3 Creation:</strong> 
        <ul>
          <li>Cooldown check passed (no cooldown in initial state)</li>
          <li>Max VM count check passed (current 2 < max 4)</li>
          <li>Jenkins pipeline execution: VM creation, F5 registration, Prometheus registration (approximately 5 minutes)</li>
          <li>VM 3 Service Deployment Complete</li>
          <li>Start Cooldown (5 minutes)</li>
        </ul>
      </li>
      <li><strong>VM 4 Creation:</strong>
        <ul>
          <li>Load still high, CPU exceeds 80% continuously</li>
          <li>Wait for cooldown end (5 minutes)</li>
          <li>Alertmanager re-sends after 5 minutes (repeat_interval)</li>
          <li>Create VM 4 after cooldown end verification (approximately 5 minutes)</li>
          <li>VM 4 Service Deployment Complete</li>
          <li>Scale-out blocked thereafter as max VM count (4) reached</li>
        </ul>
      </li>
    </ol>

    <h4>Scale-In Scenario</h4>
    <div class="mermaid">gantt
    title Scale-In Timeline
    dateFormat HH:mm
    axisFormat %H:%M
    
    section Max Count Reached
    VM 1 Running :active, vm1_in, 00:00, 30m
    VM 2 Running :active, vm2_in, 00:00, 30m
    VM 3 Running :active, vm3_in, 00:00, 30m
    VM 4 Running :active, vm4_in, 00:00, 30m
    
    section Load Decrease
    Overall CPU Below 30% :done, low_load, 00:05, 5m
    Alert Triggered :milestone, alert_in1, 00:10, 0m
    Cooldown Check :done, cd_in1, 00:10, 1m
    
    section VM 4 Deletion
    VM 4 Deletion Started :active, vm4_del, 00:11, 2m
    VM 4 Deletion Complete :milestone, vm4_done, 00:13, 0m
    Start Cooldown (5 minutes) :active, cooldown_in1, 00:13, 5m
    
    section VM 3 Deletion
    CPU Still Below 30% :done, low_load2, 00:13, 5m
    Alert Re-triggered (after 5 minutes) :milestone, alert_in2, 00:18, 0m
    Cooldown End Verified :done, cd_in2, 00:18, 1m
    VM 3 Deletion Started :active, vm3_del, 00:19, 2m
    VM 3 Deletion Complete :milestone, vm3_done, 00:21, 0m
    Start Cooldown (5 minutes) :active, cooldown_in2, 00:21, 5m
    
    section Maintain Min Count
    VM 1 Maintained :active, vm1_keep, 00:21, 10m
    VM 2 Maintained :active, vm2_keep, 00:21, 10m
    Scale-In Blocked as Min Count Reached :crit, block, 00:21, 10m</div>

    <p><strong>Scale-In Process:</strong></p>
    <ol>
      <li><strong>Max Count Reached:</strong> VM 1, 2, 3, 4 all running</li>
      <li><strong>Load Decrease:</strong> Overall CPU usage below 30% for more than 5 minutes</li>
      <li><strong>Alert Triggered:</strong> Alert firing from Prometheus → sent to Alertmanager</li>
      <li><strong>VM 4 Deletion (Newest VM):</strong>
        <ul>
          <li>Cooldown Check Pass</li>
          <li>Min VM count check passed (current 4 > min 2)</li>
          <li>Jenkins pipeline execution: select newest VM (4), F5 removal, Prometheus removal, VM deletion (approximately 2 minutes)</li>
          <li>VM 4 Deletion Complete</li>
          <li>Start Cooldown (5 minutes)</li>
        </ul>
      </li>
      <li><strong>VM 3 Deletion:</strong>
        <ul>
          <li>Load still low, CPU below 30% continuously</li>
          <li>Wait for cooldown end (5 minutes)</li>
          <li>Alertmanager re-sends after 5 minutes (repeat_interval)</li>
          <li>Delete VM 3 after cooldown end verification (approximately 2 minutes)</li>
          <li>VM 3 Deletion Complete</li>
        </ul>
      </li>
      <li><strong>Maintain Min Count:</strong>
        <ul>
          <li>Current VM count: 2 (VM 1, VM 2)</li>
          <li>Scale-in blocked thereafter as min VM count (2) reached</li>
          <li>VM 1 and VM 2 maintained at minimum count</li>
        </ul>
      </li>
    </ol>

    <h4>Timing Summary</h4>
    <table>
      <tr>
        <th>Event</th>
        <th>Duration</th>
        <th>Description</th>
      </tr>
      <tr>
        <td>VM Creation (Scale-Out)</td>
        <td>Approximately 5 minutes</td>
        <td>Template clone, IP configuration, F5 registration, Prometheus registration</td>
      </tr>
      <tr>
        <td>VM Deletion (Scale-In)</td>
        <td>Approximately 2 minutes</td>
        <td>F5 Removal, Prometheus Removal, VM Deletion</td>
      </tr>
      <tr>
        <td>Cooldown Period</td>
        <td>5 minutes</td>
        <td>Wait time until next action after scale-out/in</td>
      </tr>
      <tr>
        <td>Alertmanager Re-transmission</td>
        <td>5 minutes</td>
        <td>Re-transmit every 5 minutes if alert is not resolved</td>
      </tr>
      <tr>
        <td>Scale-Out: 3 → 4</td>
        <td>Approximately 10 minutes later</td>
        <td>Cooldown (5 min) + Alert re-transmission (5 min) = minimum 10 minutes later</td>
      </tr>
      <tr>
        <td>Scale-In: Delete 4</td>
        <td>Approximately 10 minutes later</td>
        <td>Scale-in condition duration (5 min) + Alert trigger + Processing (2 min) = approximately 10 minutes later</td>
      </tr>
      <tr>
        <td>Scale-In: Delete 3</td>
        <td>Approximately 10 minutes later</td>
        <td>Cooldown (5 min) + Alert re-transmission (5 min) + Processing (2 min) = approximately 10 minutes later</td>
      </tr>
    </table>
  </div>

  <h3 id="section-13-3">13.3 Scalability</h3>
  <ul>
    <li><b>Independent Operation per Service</b>
      <ul>
        <li>Each service uses independent configuration and jobs</li>
        <li>No impact between services</li>
        <li>Multiple services can autoscale simultaneously</li>
      </ul>
    </li>
    <li><b>IP Pool Management</b>
      <ul>
        <li>Specify IP pool range per service</li>
        <li>Prevent IP conflicts</li>
        <li>Block scale-out when IP pool is insufficient</li>
      </ul>
    </li>
    <li><b>Resource Limits</b>
      <ul>
        <li>Limit resource usage with max VM count</li>
        <li>Utilize vCenter resource pool</li>
        <li>Monitor datastore capacity</li>
      </ul>
    </li>
  </ul>

  <h3 id="section-13-4">13.4 Monitoring and Alerts</h3>
  <div class="box">
    <h4>Monitoring Items</h4>
    <ul>
      <li><b>System Metrics</b>
        <ul>
          <li>CPU usage (overall and per instance)</li>
          <li>Memory usage (overall and per instance)</li>
          <li>Current VM Count</li>
          <li>Number of scale events</li>
        </ul>
      </li>
      <li><b>Infrastructure Metrics</b>
        <ul>
          <li>vCenter connection status</li>
          <li>Prometheus target status</li>
          <li>F5 pool member status</li>
          <li>Jenkins job execution status</li>
        </ul>
      </li>
      <li><b>Alerts</b>
        <ul>
          <li>Scale-out/in event alerts</li>
          <li>Error occurrence alerts</li>
          <li>Max/min count reached alerts</li>
          <li>IP pool shortage alerts</li>
        </ul>
      </li>
    </ul>
  </div>

  <!-- 14. Future Enhancements -->
  <h2 id="section-14">14. Future Enhancement Directions</h2>

  <h3 id="section-14-1">14.1 Tenant-Based Permission Separation</h3>
  <ul>
    <li>Currently only administrators can configure all services</li>
    <li>Future: Separate accessible services and autoscaling configurations per tenant</li>
    <li>Role-based access control (RBAC) examples:
      <ul>
        <li>GLOBAL_ADMIN, TENANT_ADMIN, TENANT_VIEWER, etc.</li>
      </ul>
    </li>
  </ul>

  <h3 id="section-14-2">14.2 Tenant-Dedicated Server/Infrastructure</h3>
  <ul>
    <li>For large tenants, provide dedicated instances of Autoscaling Backend/Jenkins/PLG/F5 partitions</li>
    <li>Completely separate operation of min/maxVms, IP pool, VLAN, templates, and monitoring per tenant</li>
  </ul>

  <h3 id="section-14-3">14.3 Advanced Feature Ideas</h3>
  <ul>
    <li><b>Predictive Scaling</b>
      <ul>
        <li>AI/machine learning-based traffic prediction</li>
        <li>Time-based pattern analysis</li>
        <li>Reduce response time with preemptive scale-out</li>
      </ul>
    </li>
    <li><b>Cost Optimization</b>
      <ul>
        <li>Time/day-based scaling policies</li>
        <li>Cost-based scale-in priority</li>
        <li>Resource usage-based optimization</li>
      </ul>
    </li>
    <li><b>Hybrid Autoscaling</b>
      <ul>
        <li>Integration with Kubernetes (CAPV)</li>
        <li>Integrated management of cloud and on-premises</li>
        <li>Automatic placement based on workload characteristics</li>
      </ul>
    </li>
    <li><b>Advanced Monitoring</b>
      <ul>
        <li>Application-level metric-based scaling</li>
        <li>Utilize JMX metrics</li>
        <li>Custom metric support</li>
      </ul>
    </li>
  </ul>

  <!-- 15. Summary and Key Points -->
  <h2 id="section-15">15. Summary and Key Points</h2>

  <h3 id="section-15-1">15.1 Core Architecture Principles</h3>
  <div class="box">
    <ul>
      <li><b>Non-intrusive Design:</b> Maximize reuse of existing infrastructure (PLG Stack, Jenkins, F5, vSphere)</li>
      <li><b>Single Criteria Principle:</b> Determine min/max count only based on number of VMs registered in Prometheus Job</li>
      <li><b>Cooldown Mechanism:</b> Prevent repeated alerts and protect resources</li>
      <li><b>Service Independence:</b> Each service operates independently with no mutual impact</li>
      <li><b>Automation:</b> Automate entire process from configuration to execution</li>
    </ul>
  </div>

  <h3 id="section-15-2">15.2 Key Features</h3>
  <table>
    <tr>
      <th>Item</th>
      <th>Description</th>
    </tr>
    <tr>
      <td>Template-Based</td>
      <td>Fast VM creation based on Golden Image template</td>
    </tr>
    <tr>
      <td>Metric-Based</td>
      <td>Automatic determination based on Prometheus Node Exporter metrics</td>
    </tr>
    <tr>
      <td>Webhook-Based</td>
      <td>Alertmanager → Backend (validation: switch/cooldown/VM count) → Jenkins webhook chain</td>
    </tr>
    <tr>
      <td>Automatic Registration</td>
      <td>Automatic registration of F5 Pool and Prometheus Target on VM creation</td>
    </tr>
    <tr>
      <td>Safe Deletion</td>
      <td>Guaranteed order: F5 removal → Monitoring removal → Prometheus removal → VM deletion</td>
    </tr>
  </table>

  <h3 id="section-15-3">15.3 Performance Metrics</h3>
  <table>
    <tr>
      <th>Task</th>
      <th>Expected Duration</th>
    </tr>
    <tr>
      <td>Scale-Out (VM Creation)</td>
      <td>Approximately 3-5 minutes</td>
    </tr>
    <tr>
      <td>Scale-In (VM Deletion)</td>
      <td>Approximately 2 minutes</td>
    </tr>
    <tr>
      <td>Cooldown Period</td>
      <td>Default 5 minutes (configurable)</td>
    </tr>
    <tr>
      <td>Alert Evaluation Cycle</td>
      <td>5 minutes (Prometheus scrape interval)</td>
    </tr>
    <tr>
      <td>Alertmanager Re-transmission Cycle</td>
      <td>5 minutes (repeat_interval)</td>
    </tr>
  </table>

  <h3 id="section-15-4">15.4 Limitations and Considerations</h3>
  <div class="warning">
    <ul>
      <li><b>IP Pool Range:</b> Scale-out will be blocked if IP pool is insufficient. Ensure sufficient IP range.</li>
      <li><b>Template Preparation:</b> VM creation may fail if template is not properly prepared.</li>
      <li><b>Network Connectivity:</b> Network connection must be stable after VM creation for F5 health check to pass.</li>
      <li><b>Cooldown Period:</b> Scaling does not occur during cooldown period, so response to sudden load changes may be delayed.</li>
      <li><b>Minimum VM Count:</b> Scale-in does not occur below minimum VM count, ensuring service availability.</li>
    </ul>
  </div>

  <!-- 16. References -->
  <h2 id="section-16">16. References</h2>
  <ul>
    <li><a href="https://prometheus.io/docs/">Prometheus Official Documentation</a></li>
    <li><a href="https://prometheus.io/docs/alerting/latest/alertmanager/">Alertmanager Official Documentation</a></li>
    <li><a href="https://www.jenkins.io/doc/">Jenkins Official Documentation</a></li>
    <li><a href="https://github.com/vmware/govmomi">govc (vSphere CLI) Documentation</a></li>
    <li><a href="https://clouddocs.f5.com/">F5 BIG-IP Documentation</a></li>
  </ul>
  <ul>
    <li>AI/machine learning-based predictive scaling</li>
    <li>Time/day-based cost optimization policies</li>
    <li>Hybrid autoscaling integrated with Kubernetes (CAPV)</li>
  </ul>

</body>
</html>

