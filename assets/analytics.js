/*! analytics.js — ウインライフ アクセス解析＋Cookie同意
 *
 *   設計:
 *   1. ページ読み込み時に localStorage を見て同意状態を確認
 *   2. 未決定なら同意バナーを表示
 *   3. 同意 → GA4 gtag.js を遅延ロード（本番ID未設定時は何もしない）
 *   4. 拒否 → 何も読み込まない、状態を覚える
 *   5. フッターの「クッキー設定」リンクで再設定可能（任意配置）
 *
 *   GA4 ID の差し替え:
 *   下の GA4_ID に Google Analytics で取得した「測定ID」（G-XXXXXXXXXX）を入れる。
 *   未設定（'G-XXXXXXXXXX'のまま）の場合、同意後も gtag は読み込まれない。
 */
(function () {
  'use strict';

  // ===== 設定 =====
  var GA4_ID = 'G-XXXXXXXXXX';                 // ← 本番取得後にここを差し替え
  var STORAGE_KEY = 'wlf_consent_v1';           // 同意状態の保存キー（バージョン付き）
  var BANNER_DELAY_MS = 600;                    // 表示遅延（コンテンツ読了後）

  // ===== ユーティリティ =====
  function getConsent() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function setConsent(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) { /* localStorage不可（プライベートブラウズ等）はそのまま */ }
  }

  // ===== GA4 読み込み =====
  function loadGA4() {
    if (!GA4_ID || GA4_ID === 'G-XXXXXXXXXX') {
      console.info('[analytics] GA4_ID 未設定のため、同意済みでも計測は走りません');
      return;
    }
    if (window.gtag) return; // 二重ロード防止

    // gtag.js を遅延ロード
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID);
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID, {
      anonymize_ip: true,                       // IPアノニマイズ
      allow_google_signals: false,              // Google広告との連携OFF（同意外）
      allow_ad_personalization_signals: false,  // 広告パーソナライズOFF
    });
  }

  // ===== 同意バナーUI =====
  function injectBannerStyles() {
    if (document.getElementById('wlf-consent-style')) return;
    var s = document.createElement('style');
    s.id = 'wlf-consent-style';
    s.textContent = [
      '.wlf-consent{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;',
      'background:#fff;color:#2E2A28;border:2px solid #B23E63;border-radius:14px;',
      'padding:16px 20px;box-shadow:0 8px 32px rgba(0,0,0,.18);',
      'font-family:"Noto Sans JP",sans-serif;font-size:14px;line-height:1.6;',
      'display:flex;flex-wrap:wrap;align-items:center;gap:12px;max-width:880px;margin:0 auto;',
      'opacity:0;transform:translateY(20px);transition:opacity .4s ease,transform .4s ease}',
      '.wlf-consent.is-shown{opacity:1;transform:none}',
      '.wlf-consent .msg{flex:1;min-width:240px}',
      '.wlf-consent .msg strong{color:#B23E63;display:block;margin-bottom:4px;font-size:15px}',
      '.wlf-consent .msg a{color:#B23E63;font-weight:700}',
      '.wlf-consent .actions{display:flex;gap:8px;flex-wrap:wrap}',
      '.wlf-consent button{font:inherit;border:0;border-radius:10px;padding:10px 18px;',
      'cursor:pointer;font-weight:700;font-size:14px;line-height:1.2;transition:transform .15s ease,filter .15s ease}',
      '.wlf-consent button:hover{transform:translateY(-1px);filter:brightness(1.05)}',
      '.wlf-consent .agree{background:#B23E63;color:#fff}',
      '.wlf-consent .decline{background:#fff;color:#2E2A28;border:1.5px solid #ccc}',
      '@media(max-width:560px){',
      '  .wlf-consent{flex-direction:column;align-items:stretch;text-align:left}',
      '  .wlf-consent .actions{justify-content:flex-end}',
      '  .wlf-consent button{flex:1}',
      '}',
      '@media(prefers-reduced-motion:reduce){.wlf-consent{transition:none}}',
    ].join('');
    document.head.appendChild(s);
  }

  function showBanner() {
    injectBannerStyles();
    var b = document.createElement('div');
    b.className = 'wlf-consent';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', 'Cookie同意の確認');
    b.innerHTML = [
      '<div class="msg">',
      '  <strong>アクセス解析にご協力ください</strong>',
      '  サイト改善のため、Google Analytics でアクセス状況を計測しています（個人を特定する情報は収集しません）。',
      '  詳しくは<a href="privacy.html#cookie">プライバシーポリシー</a>をご覧ください。',
      '</div>',
      '<div class="actions">',
      '  <button class="decline" type="button">拒否する</button>',
      '  <button class="agree"   type="button">同意する</button>',
      '</div>',
    ].join('');
    document.body.appendChild(b);
    // フェードイン
    requestAnimationFrame(function () {
      b.classList.add('is-shown');
    });

    b.querySelector('.agree').addEventListener('click', function () {
      setConsent('agree');
      loadGA4();
      hideBanner(b);
    });
    b.querySelector('.decline').addEventListener('click', function () {
      setConsent('decline');
      hideBanner(b);
    });
  }

  function hideBanner(b) {
    b.classList.remove('is-shown');
    setTimeout(function () {
      if (b.parentNode) b.parentNode.removeChild(b);
    }, 400);
  }

  // ===== Cookie設定の再表示用フック =====
  // フッターに <a data-wlf-consent-reset href="#">クッキー設定</a> を置けばクリックで再表示
  function bindResetLinks() {
    var links = document.querySelectorAll('[data-wlf-consent-reset]');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', function (e) {
        e.preventDefault();
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
        showBanner();
      });
    }
  }

  // ===== 起動 =====
  function start() {
    bindResetLinks();
    var c = getConsent();
    if (c === 'agree') {
      loadGA4();
    } else if (c === 'decline') {
      // 何もしない
    } else {
      // 未決定 → バナー表示
      setTimeout(showBanner, BANNER_DELAY_MS);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
