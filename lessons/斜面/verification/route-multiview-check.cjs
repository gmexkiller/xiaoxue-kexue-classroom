const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');

const file = path.join(__dirname, '..', 'output', '斜面_胡拉拉课堂版.html');
const shots = path.join(__dirname, 'current');
fs.mkdirSync(shots, { recursive: true });
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function anchor(page) {
  await page.waitForFunction(() => Boolean(document.querySelector('#drawingSurface').dataset.anchorScreen));
  const box = await page.locator('#drawingSurface').boundingBox();
  const [x, y] = (await page.locator('#drawingSurface').getAttribute('data-anchor-screen')).split(',').map(Number);
  return { x: box.x + box.width * x, y: box.y + box.height * y, box };
}
async function mouseStroke(page, start, offsets) {
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  for (const [dx, dy] of offsets) await page.mouse.move(start.x + dx, start.y + dy, { steps: 18 });
  await page.mouse.up();
}
async function touchStroke(cdp, start, offsets) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start.x, y: start.y, id: 1 }] });
  let previous = [0, 0];
  for (const [dx, dy] of offsets) {
    for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + previous[0] + (dx - previous[0]) * i / 12, y: start.y + previous[1] + (dy - previous[1]) * i / 12, id: 1 }] });
    previous = [dx, dy];
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--enable-webgl', '--use-angle=swiftshader'] });
  const errors = [];
  try {
    if (!process.argv.includes('--touch-only')) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(pathToFileURL(file).href);
    await page.locator('[data-phase=routes]').click();
    await page.waitForTimeout(5200);
    const failedPosition = await page.locator('#sceneHost').getAttribute('data-truck-position');
    await page.locator('#drawRouteButton').click();
    const footPosition = await page.locator('#sceneHost').getAttribute('data-truck-position');
    assert(failedPosition !== footPosition, '绘制前货车未从半坡返回山脚');
    assert(footPosition.startsWith('-5.000,'), `货车未回到山脚：${footPosition}`);
    const foot = await anchor(page);
    console.log('foot', foot.x, foot.y, footPosition);
    await mouseStroke(page, foot, [[18,12],[40,24],[72,31],[105,34]]);
    let points = Number(await page.locator('#drawingSurface').getAttribute('data-points'));
    assert(points >= 3, `第一段绘制失败：${points}`);
    await page.screenshot({ path: path.join(shots, '11-山脚第一段-1366.png') });
    await page.locator('#pauseRouteButton').click();
    assert(await page.locator('#drawingSurface').isHidden(), '调整视角时绘制层未关闭');
    const beforeOrbit = await page.locator('#sceneHost canvas').screenshot();
    const canvas = await page.locator('#sceneHost canvas').boundingBox();
    await page.mouse.move(canvas.x + canvas.width*.54, canvas.y + canvas.height*.5);
    await page.mouse.down(); await page.mouse.move(canvas.x + canvas.width*.47, canvas.y + canvas.height*.5, { steps: 24 }); await page.mouse.up();
    await page.waitForTimeout(350);
    assert(!beforeOrbit.equals(await page.locator('#sceneHost canvas').screenshot()), '暂停绘制后无法转动山体');
    await page.screenshot({ path: path.join(shots, '12-暂停绘制并转山-1366.png') });
    await page.locator('#drawRouteButton').click();
    assert(await page.locator('#drawingSurface').isVisible(), '调整视角后无法继续绘制');
    const continued = await anchor(page);
    console.log('continued', continued.x, continued.y);
    await mouseStroke(page, { x: continued.box.x + continued.box.width*.2, y: continued.box.y + continued.box.height*.35 }, [[10,-10]]);
    assert((await page.locator('#routeToolNote').innerText()).includes('上一段终点'), '远离终点起笔未提示');
    assert(Number(await page.locator('#drawingSurface').getAttribute('data-points')) === points, '远距离起笔改变了原路线');
    await mouseStroke(page, continued, [[16,-10],[36,-25],[55,-50],[76,-65]]);
    points = Number(await page.locator('#drawingSurface').getAttribute('data-points'));
    console.log('second result', points, await page.locator('#drawingSurface').getAttribute('data-segments'), await page.locator('#routeToolNote').innerText());
    assert(points >= 5, `转山后第二段绘制失败：${points}`);
    assert(await page.locator('#drawingSurface').getAttribute('data-segments') === '2', '两段未保存为同一方案');
    await page.screenshot({ path: path.join(shots, '13-绕山第二段-1366.png') });
    await page.locator('#pauseRouteButton').click();
    const canvas2 = await page.locator('#sceneHost canvas').boundingBox();
    await page.mouse.move(canvas2.x + canvas2.width*.52, canvas2.y + canvas2.height*.5);
    await page.mouse.down(); await page.mouse.move(canvas2.x + canvas2.width*.57, canvas2.y + canvas2.height*.5, { steps: 20 }); await page.mouse.up();
    await page.waitForTimeout(350);
    await page.locator('#drawRouteButton').click();
    const third = await anchor(page);
    console.log('third', third.x, third.y);
    await mouseStroke(page, third, [[12,-14],[30,-31],[50,-50],[65,-68]]);
    assert(await page.locator('#drawingSurface').getAttribute('data-segments') === '3', '第三段未加入同一方案');
    await page.locator('#pauseRouteButton').click();
    const canvas3 = await page.locator('#sceneHost canvas').boundingBox();
    await page.mouse.move(canvas3.x + canvas3.width*.52, canvas3.y + canvas3.height*.5);
    await page.mouse.down(); await page.mouse.move(canvas3.x + canvas3.width*.66, canvas3.y + canvas3.height*.5, { steps: 25 }); await page.mouse.up();
    await page.waitForTimeout(350);
    await page.locator('#drawRouteButton').click();
    const around = await anchor(page);
    console.log('around', around.x, around.y);
    await page.screenshot({ path: path.join(shots, '14a-转向山体另一侧-1366.png') });
    await mouseStroke(page, around, [[15,8],[36,18],[62,24],[82,38]]);
    console.log('around result', await page.locator('#drawingSurface').getAttribute('data-segments'), await page.locator('#routeToolNote').innerText());
    assert(await page.locator('#drawingSurface').getAttribute('data-segments') === '4', '绕山另一侧的第四段未加入同一方案');
    await page.locator('#finishRouteButton').click();
    assert(await page.locator('#drawingSurface').isHidden(), '完成绘制后未恢复相机');
    await page.screenshot({ path: path.join(shots, '14-绕山路线完成-1366.png') });
    await page.locator('#clearRouteButton').click();
    assert(await page.locator('#drawingSurface').getAttribute('data-points') === '0', '清除路线失败');
    await context.close();
    }

    if (!process.argv.includes('--mouse-only')) {
    const touchContext = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, hasTouch: true, isMobile: false });
    const touchPage = await touchContext.newPage();
    touchPage.on('pageerror', e => errors.push(`touch: ${e.message}`));
    await touchPage.goto(pathToFileURL(file).href);
    await touchPage.locator('[data-phase=routes]').tap(); await touchPage.waitForTimeout(5200);
    await touchPage.locator('#drawRouteButton').tap();
    const touchAnchor = await anchor(touchPage);
    const cdp = await touchContext.newCDPSession(touchPage);
    await touchStroke(cdp, touchAnchor, [[25,-25],[55,-55],[75,-85]]);
    assert(Number(await touchPage.locator('#drawingSurface').getAttribute('data-points')) >= 3, '单指绘制失败');
    await touchPage.locator('#pauseRouteButton').tap();
    const beforeTouchOrbit = await touchPage.locator('#sceneHost canvas').screenshot();
    const tb = await touchPage.locator('#sceneHost canvas').boundingBox();
    await touchStroke(cdp, { x: tb.x + tb.width*.55, y: tb.y + tb.height*.5 }, [[42,0]]);
    await touchPage.waitForTimeout(350);
    assert(!beforeTouchOrbit.equals(await touchPage.locator('#sceneHost canvas').screenshot()), '单指调整视角失败');
    const beforePinch = await touchPage.locator('#sceneHost canvas').screenshot();
    const cx = tb.x + tb.width*.55, cy = tb.y + tb.height*.52;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx-25, y: cy, id: 1 }, { x: cx+25, y: cy, id: 2 }] });
    for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx-25-i*.6, y: cy, id: 1 }, { x: cx+25+i*.6, y: cy, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await touchPage.waitForTimeout(350);
    assert(!beforePinch.equals(await touchPage.locator('#sceneHost canvas').screenshot()), '双指调整视角未缩放');
    await touchPage.locator('#drawRouteButton').tap();
    const touchContinued = await anchor(touchPage);
    console.log('touch continued', touchContinued.x, touchContinued.y);
    await touchPage.screenshot({ path: path.join(shots, '15a-触摸调整视角后-1366.png') });
    await touchStroke(cdp, touchContinued, [[20,-15],[45,-36],[65,-55]]);
    console.log('touch segments', await touchPage.locator('#drawingSurface').getAttribute('data-segments'), await touchPage.locator('#routeToolNote').innerText());
    assert(await touchPage.locator('#drawingSurface').getAttribute('data-segments') === '2', '触摸分段续画失败');
    await touchPage.locator('#finishRouteButton').tap();
    await touchPage.screenshot({ path: path.join(shots, '15-触摸跨视角路线-1366.png') });
    await touchContext.close();
    }
    assert(errors.length === 0, `控制台错误：${errors.join(' | ')}`);
    console.log(JSON.stringify({ result: 'PASS', errors }, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
