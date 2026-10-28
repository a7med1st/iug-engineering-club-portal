const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');
// Requires Playwright (or PLAYWRIGHT_MODULE) and its Chromium browser installed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const source = fs.readFileSync('app/activities/[id]/register/page.tsx', 'utf8');
  const registrationSection = source.match(/<section className="activity-registration-content"[^>]*>/)[0];
  const build = await esbuild.build({
    stdin: { contents: `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import ScrollReveal from './components/ScrollReveal';import './app/globals.css';import './app/theme.css';import './app/ui-refinements.css';
      function App(){const [route,setRoute]=useState('/activities');window.__pathname=route;window.__navigate=()=>setRoute('/activities/survey/register');return <><ScrollReveal/><main data-page-transition-content>{route==='/activities'?<button onClick={window.__navigate}>Register</button>:<main className="activity-registration-page"><section className="activity-registration-hero" style={{minHeight:1100}}><div className="activity-registration-shell"><h1>Survey</h1></div></section>${registrationSection}<div className="activity-registration-shell"><div className="activity-registration-card"><h2>Registration</h2><form>{Array.from({length:100},(_,i)=><label key={i} style={{display:'block',minHeight:110}}>Question {i+1}<input name={'q'+i}/></label>)}<button>Submit</button></form></div></div></section><div className="section-head" style={{height:150}}>Next section</div></main>}</main></>};createRoot(document.getElementById('root')).render(<App/>);`, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, outdir: 'artifacts/visibility-preview', jsx: 'automatic', platform: 'browser', external: ['/fonts/*','/images/*'],
    plugins: [{ name: 'next-shim', setup(build) {
      build.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'shim'}));
      build.onLoad({filter:/.*/,namespace:'shim'},()=>({contents:`export const usePathname=()=>window.__pathname||'/activities';`}));
    }}],
  });
  const files = new Map(build.outputFiles.map(file=>[path.basename(file.path),file.contents]));
  const server = http.createServer((req,res)=>{
    const name=path.basename(new URL(req.url,'http://localhost').pathname);
    if(files.has(name)){res.setHeader('Content-Type',name.endsWith('.css')?'text/css':'application/javascript');res.end(files.get(name));}
    else if (/\.(woff2?|png|svg)$/.test(name)){res.writeHead(404);res.end();}
    else {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/stdin.css"><div id="root"></div><script src="/stdin.js"></script></html>');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser = await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.CHROMIUM_EXECUTABLE_PATH} : {}),args:['--disable-gpu']});
  try {
    for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
      const page=await browser.newPage({viewport});
      await page.goto('http://127.0.0.1:'+server.address().port);
      await page.getByRole('button',{name:'Register',exact:true}).click();
      const card=page.locator('.activity-registration-card');
      await card.waitFor();
      await page.waitForTimeout(200);
      assert.equal(await card.evaluate(el=>getComputedStyle(el).opacity),'1','survey must be visible immediately after client navigation');
      await page.evaluate(()=>window.scrollTo(0,1400));
      await page.waitForTimeout(1500);
      const result=await card.evaluate(el=>({state:el.dataset.revealState,opacity:getComputedStyle(el).opacity}));
      assert.equal(result.opacity,'1','survey must be visible after scrolling without reload');
      await page.evaluate(()=>window.scrollTo(0,0));
      assert.equal(await card.getAttribute('data-reveal-state'),null,'registration never depends on reveal observer');
      await page.locator('input[name="q0"]').fill('Student response');
      assert.equal(await page.locator('input[name="q0"]').inputValue(),'Student response');
      const animated=page.locator('.section-head');
      await animated.evaluate(el=>el.scrollIntoView());
      await page.waitForFunction(()=>document.querySelector('.section-head').dataset.revealState==='visible');
      await page.evaluate(()=>{
        const section=document.createElement('section');
        section.className='admin-card';
        section.style.cssText='height:11000px;margin-top:1200px';
        section.textContent='Streamed long section';
        document.querySelector('main[data-page-transition-content]').append(section);
      });
      await page.waitForFunction(()=>document.querySelector('.admin-card').dataset.revealState==='pending');
      await page.locator('.admin-card').evaluate(el=>window.scrollTo(0,el.offsetTop+300));
      await page.waitForFunction(()=>document.querySelector('.admin-card').dataset.revealState==='visible');
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.reload();
      await page.getByRole('button',{name:'Register',exact:true}).click();
      assert.equal(await card.evaluate(el=>getComputedStyle(el).opacity),'1','reduced motion keeps survey visible');
      console.log('Registration visibility passed at '+viewport.width+'px.');
      await page.close();
    }
  } finally {await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
