const { chromium } = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');

const lesson = path.resolve(__dirname, '..');
const pageUrl = pathToFileURL(path.join(lesson, 'output', '斜面_胡拉拉课堂版.html')).href;
const imageDir = path.join(__dirname, 'current');
fs.mkdirSync(imageDir, { recursive: true });
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const routeAnchor = async page => {
  await page.waitForFunction(() => Boolean(document.querySelector('#drawingSurface').dataset.anchorScreen));
  const box = await page.locator('#drawingSurface').boundingBox();
  const [x,y] = (await page.locator('#drawingSurface').getAttribute('data-anchor-screen')).split(',').map(Number);
  return { x: box.x + box.width*x, y: box.y + box.height*y };
};

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--enable-webgl', '--use-angle=swiftshader'] });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') errors.push(`${message.type()}: ${message.text()}`); });
  try {
    await page.goto(pageUrl);
    await page.locator('#sceneHost canvas').waitFor();
    await page.waitForTimeout(1100);
    await page.screenshot({ path: path.join(imageDir, '01-搬货问题动画-1366.png') });
    await page.waitForTimeout(3300);
    assert((await page.locator('#questionTitle').innerText()).includes('怎样更轻松'), '项目一问题未出现');
    assert(await page.locator('#methodChoices').isHidden(), '提前显示斜面答案');
    await page.locator('#animateButton').click();
    const cargoSamples = await page.evaluate(() => new Promise(resolve => {
      const values = [], timer = setInterval(() => {
        const host = document.querySelector('#sceneHost');
        values.push({ t: Number(host.dataset.animationProgress), lift: Number(host.dataset.cargoLift) });
      }, 80);
      setTimeout(() => { clearInterval(timer); resolve(values); }, 4050);
    }));
    assert(Math.max(...cargoSamples.map(s => s.lift)) >= .55 && Math.max(...cargoSamples.map(s => s.lift)) <= .65, '项目一抬升高度不符合短距离尝试');
    assert(cargoSamples.at(-1).lift < .02, '项目一货物未放回地面');
    await page.locator('#showMethodsButton').click();
    assert(await page.locator('#methodChoices').isVisible(), '学生办法未显示');

    await page.locator('[data-phase=evidence]').click();
    await page.locator('[data-data-view=class]').click();
    assert(await page.locator('#classDataEmpty').isVisible(), '无数据空状态缺失');
    await page.screenshot({ path: path.join(imageDir, '02-全班无数据-1366.png') });
    await page.locator('#openDataButton').click();
    assert(await page.locator('#dataRows tr').count() === 6, '默认不是六组');
    await page.screenshot({ path: path.join(imageDir, '02b-六组真实数据录入-1366.png') });
    await page.locator('#dataRows tr').first().locator('input[type=number]').nth(0).fill('9');
    await page.locator('#dataRows tr').first().locator('input[type=number]').nth(1).fill('6');
    await page.locator('#saveDataButton').click();
    assert(await page.locator('#smallClassChart svg rect').count() === 2, '部分数据柱数不正确');
    await page.screenshot({ path: path.join(imageDir, '03-全班部分数据-1366.png') });

    await page.locator('#openDataButton').click();
    const records = [[9,6,5,4],[8,6,5,4],[10,7,5,4],[9,6,5,4],[11,8,6,4],[7,4,3,2]];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) await page.locator('#dataRows tr').nth(i).locator('input[type=number]').nth(j).fill(String(records[i][j]));
    await page.locator('#dataRows tr').nth(5).locator('input[type=checkbox]').uncheck();
    await page.locator('#saveDataButton').click();
    const smallText = await page.locator('#smallClassChart').innerText();
    assert(smallText.includes('9.4') && smallText.includes('6.6') && smallText.includes('5.2') && smallText.includes('4'), `平均值错误：${smallText}`);
    assert(await page.locator('#smallClassChart svg circle').count() === 24, '各组点未保留');
    await page.screenshot({ path: path.join(imageDir, '04-全班完整数据小窗-1366.png') });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.locator('[data-phase=evidence]').click();
    await page.locator('[data-data-view=class]').click();
    assert((await page.locator('#smallClassChart').innerText()).includes('9.4'), '刷新后课堂数据未恢复');
    await page.locator('#expandChartButton').click();
    assert(await page.locator('#chartScreen').isVisible(), '大屏未打开');
    assert(await page.locator('#largeRevealBox').isHidden(), '大屏提前揭示结论');
    await page.screenshot({ path: path.join(imageDir, '05-图表中央大屏-1366.png') });
    await page.locator('#largeRevealButton').click();
    assert(await page.locator('#largeRevealBox').isVisible(), '教师揭示无效');
    const revealBounds = await page.locator('#largeRevealBox').boundingBox();
    const stageBounds = await page.locator('#chartScreen').boundingBox();
    assert(revealBounds.y + revealBounds.height <= stageBounds.y + stageBounds.height + 1, '揭示文字超出中央舞台');
    await page.screenshot({ path: path.join(imageDir, '05b-教师揭示结论-1366.png') });
    await page.keyboard.press('Escape');
    assert(await page.locator('#chartScreen').isHidden(), 'ESC 未退出图表');

    await page.locator('[data-phase=routes]').click();
    assert(await page.locator('#routePrompt').isHidden(), '设计提示提前显示');
    const mountainSamples = await page.evaluate(() => new Promise(resolve => {
      document.querySelector('#animateButton').click();
      const values = [], timer = setInterval(() => {
        const host = document.querySelector('#sceneHost');
        values.push({ t: Number(host.dataset.animationProgress), tag: document.querySelector('#stageTag').textContent, alignment: Number(host.dataset.truckAlignment), pitch: Number(host.dataset.truckPitch), position: host.dataset.truckPosition });
      }, 80);
      setTimeout(() => { clearInterval(timer); resolve(values); }, 5250);
    }));
    const tags = mountainSamples.map(sample => sample.tag).join(' ');
    for (const part of ['山脚货车', '客户新家', '尝试直接上山', '减速停下']) assert(tags.includes(part), `山路动画缺少节奏：${part}`);
    const moving = mountainSamples.filter(sample => sample.t >= .35 && sample.t <= .8);
    assert(moving.length > 5 && Math.min(...moving.map(s => s.alignment)) > .93, `货车车头未跟随运动切线：${Math.min(...moving.map(s => s.alignment))} ${JSON.stringify(moving.slice(0, 5))}`);
    assert(Math.max(...moving.map(s => Math.abs(s.pitch))) > .03, '货车没有坡度俯仰');
    const startX = Number(mountainSamples[0].position.split(',')[0]), endX = Number(mountainSamples.at(-1).position.split(',')[0]);
    assert(endX - startX > 2, '货车未明显上坡');
    assert((await page.locator('#questionTitle').innerText()).includes('怎样设计一条货车可以通行的路线'), '项目二问题未在动画结束后出现');
    await page.screenshot({ path: path.join(imageDir, '06-山路问题动画结束-1366.png') });
    assert(await page.locator('[data-route]').count() === 0, '预设路线选项仍存在');
    await page.screenshot({ path: path.join(imageDir, '07-客户新家与空山体-1366.png') });
    await page.locator('#revealButton').click();
    assert(await page.locator('#routePrompt').isVisible(), '教师未能显示设计提示');
    const hintButtonBounds = await page.locator('#revealButton').boundingBox();
    const discussionBounds = await page.locator('.discussion').boundingBox();
    assert(hintButtonBounds.y + hintButtonBounds.height < discussionBounds.y + discussionBounds.height - 25, '展开提示后收起按钮被遮挡');
    await page.screenshot({ path: path.join(imageDir, '07a-教师显示设计提示-1366.png') });
    await page.locator('#revealButton').click();
    assert(await page.locator('#routePrompt').isHidden(), '教师未能隐藏设计提示');

    const viewCanvas = page.locator('#sceneHost canvas');
    const viewBox = await viewCanvas.boundingBox();
    await page.mouse.move(viewBox.x + viewBox.width * .5, viewBox.y + viewBox.height * .52);
    await page.mouse.wheel(0, -320); await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(imageDir, '07b-房屋正面-1366.png') });
    const orbit = async () => {
      await page.mouse.move(viewBox.x + viewBox.width * .52, viewBox.y + viewBox.height * .48);
      await page.mouse.down(); await page.mouse.move(viewBox.x + viewBox.width * .73, viewBox.y + viewBox.height * .48, { steps: 18 }); await page.mouse.up();
      await page.waitForTimeout(350);
    };
    await orbit(); await page.screenshot({ path: path.join(imageDir, '07c-房屋侧面-1366.png') });
    await orbit(); await page.screenshot({ path: path.join(imageDir, '07d-房屋背面-1366.png') });
    await page.locator('#resetViewButton').click();

    await page.locator('#drawRouteButton').click();
    assert(await page.locator('#drawingSurface').isVisible(), '未进入绘制');
    const firstAnchor = await routeAnchor(page);
    const points = [[18,12],[40,24],[72,31],[105,34]];
    await page.mouse.move(firstAnchor.x, firstAnchor.y);
    await page.mouse.down();
    for (const [x,y] of points) await page.mouse.move(firstAnchor.x + x, firstAnchor.y + y, { steps: 14 });
    await page.mouse.up();
    const drawn = Number(await page.locator('#drawingSurface').getAttribute('data-points'));
    assert(drawn >= 2, `鼠标路线未绘制，点数 ${drawn}`);
    await page.locator('#finishRouteButton').click();
    assert(await page.locator('#drawingSurface').isHidden(), '完成后未释放场景');
    assert(await page.locator('#drawingSurface').getAttribute('data-smoothed') === 'true', '完成后未进行轻度平滑');
    await page.screenshot({ path: path.join(imageDir, '08-学生路线绘制完成-1366.png') });
    await page.locator('#resetViewButton').click();
    const canvas = page.locator('#sceneHost canvas');
    const beforeOrbit = await canvas.screenshot();
    const canvasBox = await canvas.boundingBox();
    await page.mouse.move(canvasBox.x + canvasBox.width * .54, canvasBox.y + canvasBox.height * .5);
    await page.mouse.down(); await page.mouse.move(canvasBox.x + canvasBox.width * .67, canvasBox.y + canvasBox.height * .54, { steps: 15 }); await page.mouse.up();
    await page.waitForTimeout(400);
    assert(!beforeOrbit.equals(await canvas.screenshot()), '完成绘制后 3D 旋转未恢复');
    await page.screenshot({ path: path.join(imageDir, '08b-旋转后路线贴地-1366.png') });
    const beforeZoom = await canvas.screenshot();
    await page.mouse.wheel(0, -600); await page.waitForTimeout(400);
    assert(!beforeZoom.equals(await canvas.screenshot()), '完成绘制后 3D 缩放未恢复');
    await page.locator('#resetViewButton').click();
    await page.locator('#clearRouteButton').click();
    assert(await page.locator('#drawingSurface').getAttribute('data-points') === '0', '清除路线无效');
    await page.locator('#drawRouteButton').click();
    const redrawAnchor = await routeAnchor(page);
    await page.mouse.move(redrawAnchor.x, redrawAnchor.y);
    await page.mouse.down();
    await page.mouse.move(redrawAnchor.x + 70, redrawAnchor.y + 26, { steps: 32 });
    await page.mouse.up(); await page.locator('#finishRouteButton').click();
    assert(Number(await page.locator('#drawingSurface').getAttribute('data-points')) >= 2, '清除后不能重画');

    for (const [width,height] of [[1440,900],[1920,1080]]) {
      await page.setViewportSize({ width, height });
      await page.screenshot({ path: path.join(imageDir, `09-山路课堂-${width}.png`) });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert(!overflow, `${width} 水平溢出`);
    }
    await page.locator('#fullscreenButton').click();
    assert(await page.evaluate(() => Boolean(document.fullscreenElement)), '全屏无效');
    await page.locator('#fullscreenButton').click();
    assert(await page.evaluate(() => !document.fullscreenElement), '退出全屏无效');

    await context.close();
    const touch = await browser.newContext({ viewport: { width: 1366, height: 768 }, hasTouch: true, isMobile: false, deviceScaleFactor: 1 });
    const touchPage = await touch.newPage();
    touchPage.on('pageerror', error => errors.push(`touch: ${error.message}`));
    await touchPage.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await touchPage.locator('[data-phase=routes]').click();
    await touchPage.waitForTimeout(5200);
    await touchPage.locator('#drawRouteButton').tap();
    const touchAnchor = await routeAnchor(touchPage);
    const cdp = await touch.newCDPSession(touchPage);
    const positions = [[0,0],[18,12],[36,23],[55,28],[75,31]];
    for (let i = 0; i < positions.length; i++) {
      const [px,py] = positions[i];
      await cdp.send('Input.dispatchTouchEvent', { type: i ? 'touchMove' : 'touchStart', touchPoints: [{ x: touchAnchor.x + px, y: touchAnchor.y + py, id: 1 }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const touchPoints = Number(await touchPage.locator('#drawingSurface').getAttribute('data-points'));
    assert(touchPoints >= 2, `触摸路线未绘制，点数 ${touchPoints}`);
    await touchPage.locator('#finishRouteButton').tap();
    await touchPage.screenshot({ path: path.join(imageDir, '10-触摸绘制-1366.png') });
    await touch.close();
    assert(errors.length === 0, `JavaScript 控制台异常：${errors.join(' | ')}`);
    console.log(JSON.stringify({ result: 'PASS', mouseRoutePoints: drawn, touchRoutePoints: touchPoints, screenshots: imageDir, consoleIssues: errors }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
