/* 设计样稿使用本地示例，所有交互均停留在页面内。 */
const scenes = { workbench:'工作台 · 侧栏', workspace:'工作台 · 宽版', toolbar:'选区工具栏', code:'代码组件', annotation:'批注面板', excerpt:'摘录面板', settings:'设置预览', states:'组件状态' };
const glyphs = {
  pen:'M12 3 3 12v6h6l9-9-6-6Zm-7 9 6 6M3 21h18', search:'m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  filter:'M4 6h16M7 12h10M10 18h4', more:'M5 12h.01M12 12h.01M19 12h.01', copy:'M8 8h12v13H8zM16 8V3H3v13h5',
  arrow:'m9 5 7 7-7 7', note:'M5 3h10l4 4v14H5zM9 12h6M9 16h6', star:'m12 3 3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1 3-6',
  question:'M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  reference:'M4 4h6a2 2 0 0 1 2 2 2 2 0 0 1 2-2h6v15h-6a2 2 0 0 0-2 2 2 2 0 0 0-2-2H4zM12 6v15',
  action:'m13 2-9 12h7l-1 8 10-12h-7l1-8', close:'m6 6 12 12M6 18 18 6', folder:'M3 6h7l2 3h9v12H3z',
  check:'m5 12 4 4L19 6', comment:'M3 3h18v14H8l-5 4zM7 8h10M7 12h6', plus:'M12 5v14M5 12h14', code:'m8 5-6 7 6 7M16 5l6 7-6 7M14 3l-4 18', download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4', collapse:'m6 14 6-6 6 6', palette:'M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h5a3 3 0 0 0 3-3c0-4-4-7-9-7ZM7 8h.01M12 6h.01M17 8h.01M6 13h.01'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${glyphs[name] ?? glyphs.note}"/></svg>`;
const button = (label, action, symbol, cls='') => `<button type="button" class="${cls}" data-action="${action}">${symbol ? icon(symbol) : ''}${label}</button>`;
const iconButton = (label, action, symbol) => `<button type="button" class="icon ghost" aria-label="${label}" title="${label}" data-action="${action}">${icon(symbol)}</button>`;
const escapeHtml = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const sourcePath = '计算机基础 / 操作系统 / 内存管理与缓存一致性 / 多线程缓冲区的边界检查与资源释放.md';
let state = { scene:'workbench', theme:'light', width:360, scope:'当前笔记', search:'', filters:false, activeFilters:{}, selected:false, toolbarKind:'代码', semantic:'疑问', empty:'无匹配', template:'markdown', savedNote:'确认 count 的上限，避免在读取数据前越界。', draft:'确认 count 的上限，避免在读取数据前越界。', numbers:true, wrap:false, frame:'code', collection:false };
let focusReturn;
function codeLines() {
  return `<span class="code-line" data-line="20"><span class="kw">function</span> <span class="fn">readBuffer</span>(buffer, count) {</span><span class="code-line highlight" data-line="21">  <span class="kw">const</span> end = <mark class="question">Math.min(count, buffer.length)</mark>;</span><span class="code-line" data-line="22">  <span class="kw">return</span> buffer.slice(0, end);</span><span class="code-line" data-line="23">}</span>`;
}
function codeFrame(kind='code') {
  const terminal = kind === 'terminal', diff = kind === 'diff';
  return `<div class="code-frame ${kind}" data-frame="${kind}"><header class="code-header"><span class="code-title">${terminal ? '终端' : diff ? 'fix/buffer-bounds.patch' : 'src/services/read-buffer-with-bounds-validation.ts'}</span><span class="tag">${terminal ? 'bash' : diff ? 'diff · ts' : 'ts'}</span>${iconButton('复制代码','copy-code','copy')}${diff ? iconButton('复制选项','copy-menu','more') : ''}${iconButton('折叠代码','collapse-code','collapse')}</header><div class="code-content"><pre aria-label="代码示例"><code>${terminal ? '<span class="code-line" data-line="1"># 保留说明和原始空白</span><span class="code-line" data-line="2">pnpm check</span><span class="code-line" data-line="3"><span class="str">✓ 所有检查通过</span></span>' : diff ? '<span class="code-line delete" data-line="1">-return buffer.slice(0, count);</span><span class="code-line insert" data-line="2">+<span class="kw">const</span> end = Math.min(count, buffer.length);</span><span class="code-line insert" data-line="3">+<span class="kw">return</span> buffer.slice(0, end);</span>' : codeLines()}</code></pre>${!terminal && !diff ? '<details class="local-collapse"><summary>展开 8 行初始化代码</summary><pre><code>const options = { strict: true };\nconst controller = new AbortController();\nconst signal = controller.signal;\nconst cache = new Map();\nconst limit = 1024;\nconst start = 0;\nconst encoding = "utf-8";\nconst ready = true;</code></pre></details><details class="code-notes"><summary>2 处标注 · 1 条批注</summary><p>疑问 · 确认 count 的上限，避免读取越界。</p></details>' : ''}</div></div>`;
}
function card(index=0) {
  const code = index === 1;
  return `<article class="card" data-selected="${state.selected && code}"><div class="card-header"><span class="semantic ${code ? 'question' : ''}">${icon(code ? 'question' : 'star')}${code ? '疑问' : '重点'}</span><span class="tag">${code ? '代码 · TypeScript' : '正文'}</span></div>${code ? '<pre class="code-preview"><code><span class="code-line" data-line="20">function readBuffer(buffer, count) {</span><span class="code-line highlight" data-line="21">  const end = <mark class="question">Math.min(count, buffer.length)</mark>;</span><span class="code-line" data-line="22">  return buffer.slice(0, end);</span></code></pre>' : '<button class="excerpt" data-action="locate">检查输入边界时，<mark>应同时考虑调用方约束与实际缓冲区长度</mark>。</button>'}${code ? `<div class="annotation-summary">${escapeHtml(state.savedNote)}</div>` : ''}<div class="path" title="${sourcePath}">${sourcePath}</div><div class="meta">内存访问 › 边界检查${code ? ' · 第 21 行' : ''}</div><div class="card-actions">${button('定位','locate','arrow')}${button('批注','annotate','comment')}${button('复制','copy-excerpt','copy')}${iconButton('更多操作','item-menu','more')}</div><div class="item-menu" hidden></div></article>`;
}
function workbench() {
  return `<section class="panel stack" aria-label="高亮工作台"><div class="panel-head"><h2>${icon('pen')}高亮工作台</h2>${iconButton('工作台选项','workbench-menu','more')}</div><div id="workbench-menu" hidden class="menu">${button('新建集合','new-collection','plus')}${button('重建索引','rebuild','search')}</div><div class="scope" aria-label="检索范围">${['当前笔记','当前目录','全库','集合'].map(x=>`<button data-scope="${x}" aria-pressed="${state.scope===x}">${x}</button>`).join('')}</div><div class="source muted">${icon(state.scope==='集合'?'folder':'note')}<span title="${sourcePath}">${state.scope==='集合'?'阅读摘录 · 12 条':state.scope==='全库'?'全部 Markdown 笔记':'多线程缓冲区的边界检查与资源释放'}</span></div>${state.scope==='集合'?'<div class="row"><label class="field">集合<select aria-label="选择集合"><option>阅读摘录</option><option>代码审阅</option></select></label>'+button('新建','new-collection','plus')+'</div>':''}<div class="search-row"><label class="search-box">${icon('search')}<input aria-label="搜索原文和批注" placeholder="搜索原文和批注…" value="${state.search.replaceAll('&','&amp;').replaceAll('"','&quot;')}"></label><button aria-label="筛选" aria-expanded="${state.filters}" data-action="toggle-filters">${icon('filter')}</button></div>${state.filters?`<div class="filters">${['类型','语义','颜色','语言'].map((x,i)=>`<label>${x}<select aria-label="${x}筛选" data-filter="${x}"><option value="">全部${x}</option><option ${state.activeFilters[x]?'selected':''}>${['代码','疑问','橙色','TypeScript'][i]}</option></select></label>`).join('')}<label>路径<input placeholder="例如：计算机基础/" aria-label="路径筛选" data-filter="路径"></label></div>`:''}<div class="chips">${Object.entries(state.activeFilters).filter(([,value])=>value).map(([key,value])=>`<button class="chip" data-action="clear-filter" data-key="${key}">${escapeHtml(value)} ${icon('close')}</button>`).join('')}</div><div class="summary"><div class="row"><span class="muted" id="result-count">2 条重点</span><select aria-label="结果分组" id="result-group"><option>按原文</option><option>按来源</option><option>按语义</option></select></div>${button('生成摘录','open-excerpt','download')}</div><div class="results stack">${card(0)}${card(1)}</div><nav class="pagination" aria-label="分页"><button disabled aria-label="上一页">‹</button><span>1 / 1</span><button disabled aria-label="下一页">›</button></nav><div class="index-status">已索引 128 篇笔记 · 刚刚更新</div></section>`;
}
function toolbar() {
  return `<section class="panel stack"><div class="panel-head"><h2>标注内容</h2></div><label class="field">选区类型<select id="toolbar-kind">${['正文','行内代码','代码','混合选区'].map(x=>`<option ${x===state.toolbarKind?'selected':''}>${x}</option>`).join('')}</select></label><p>${state.toolbarKind==='正文'?'检查输入边界时，应同时考虑调用方约束与实际缓冲区长度。':'选中的表达式：'}</p>${state.toolbarKind==='正文'?'': '<pre><code>Math.min(count, buffer.length)</code></pre>'}<div class="toolbar" role="toolbar" aria-label="标注选区"><div class="toolbar-context">${icon('code')}${state.toolbarKind==='代码'?'代码块 2 · 第 21 行':state.toolbarKind==='混合选区'?'正文与代码 · 3 个选区':state.toolbarKind}${state.toolbarKind==='代码'?'<div class="segmented"><button aria-pressed="true" data-action="precision">精确</button><button aria-pressed="false" data-action="line-mode">整行</button></div>':''}</div><div class="semantic-row">${[['star','重点'],['question','疑问'],['reference','引用'],['action','行动']].map(([key,name])=>`<button data-semantic="${name}" aria-pressed="${state.semantic===name}">${icon(key)}<span>${name}</span></button>`).join('')}</div><div class="divider"></div><div class="row">${button('颜色','color-menu','palette')}${button('批注','annotate','comment')}${button('集合','collection-menu','folder')}${iconButton('移除标注','remove','close')}</div><div id="toolbar-menu" hidden class="menu"></div></div><small>当前标注：<span id="current-semantic">${state.semantic}</span> · 可继续添加批注</small></section>`;
}
function annotation() {
  return `<section class="panel stack" aria-label="编辑批注"><div class="panel-head"><h2>${icon('comment')}编辑批注</h2>${iconButton('关闭批注','close-panel','close')}</div><div class="row"><span class="semantic question">${icon('question')}疑问</span><span class="tag">代码 · 第 21 行</span></div><pre><code>Math.min(count, buffer.length)</code></pre><div class="path" title="${sourcePath}">${sourcePath}</div><label class="field">批注<textarea id="annotation-input" placeholder="写下你的理解或待确认的问题…"></textarea></label><span class="muted" id="draft-status">已保存的批注</span><div class="dialog-footer">${button('取消','cancel-note')}${button('保存批注','save-note',null,'primary')}</div></section>`;
}
function excerpt() {
  return `<section class="panel stack" aria-label="生成摘录"><div class="panel-head"><h2>${icon('download')}生成摘录</h2>${iconButton('关闭摘录','close-panel','close')}</div><p class="muted">${state.scope}${Object.values(state.activeFilters).filter(Boolean).map(value=>' · '+escapeHtml(value)).join('')}</p><div class="row"><strong>${sampleHits().length} 条重点</strong><span class="muted">包括批注与来源链接</span></div><label class="field">摘录格式<select id="template">${[['markdown','保留格式'],['plain','纯文本'],['quote','引用块'],['code','代码围栏']].map(([v,n])=>`<option value="${v}" ${state.template===v?'selected':''}>${n}</option>`).join('')}</select></label><h3>预览</h3><pre class="wrapped" id="export-preview"></pre><div class="muted">保存到 Highlight Boost/ · 创建新的摘录笔记</div><div class="dialog-footer">${button('复制摘录','copy-export','copy')}${button('生成笔记','generate',null,'primary')}</div></section>`;
}
function settings() {
  return `<section class="panel stack"><div class="panel-head"><h2>Highlight Boost</h2></div><div class="row"><span class="tag">标注与工具栏</span><span class="tag">代码展示</span><span class="tag">工作台与摘录</span><span class="tag">语言与数据</span></div><div class="setting-group"><h3>语义预设</h3>${['重点','疑问','引用','行动'].map((n,i)=>`<div class="preset-row"><span class="swatch" style="background:var(--color-${['yellow','orange','blue','purple'][i]})"></span><input aria-label="${n}名称" value="${n}"><select aria-label="${n}颜色"><option>${['黄色','橙色','蓝色','紫色'][i]}</option><option>绿色</option></select></div>`).join('')}</div><div class="setting-group"><h3>代码展示</h3><div class="setting-row"><div><label for="setting-numbers">逻辑行号</label><small>折行沿用同一个行号</small></div><input id="setting-numbers" type="checkbox" ${state.numbers?'checked':''}></div><div class="setting-row"><div><label for="setting-wrap">长行换行</label><small>在代码区域内完整显示长行</small></div><input id="setting-wrap" type="checkbox" ${state.wrap?'checked':''}></div><div class="setting-row"><label for="setting-frame">代码外框</label><select id="setting-frame"><option value="code">代码框</option><option value="terminal">终端框</option><option value="none">无框</option><option value="auto">自动</option></select></div><div class="setting-row"><label for="light-code-theme">浅色配色</label><select id="light-code-theme"><option>跟随 Obsidian</option><option>GitHub Light</option></select></div><div class="setting-row"><label for="dark-code-theme">深色配色</label><select id="dark-code-theme"><option>跟随 Obsidian</option><option>GitHub Dark</option></select></div><label class="field">自定义主题目录<input placeholder="例如：Assets/代码主题"></label><label class="field">自定义语言目录<input placeholder="例如：Assets/代码语法"></label><div class="setting-row"><label for="inline-syntax">行内代码着色</label><input type="checkbox" id="inline-syntax" checked></div><label class="field">排除语言<input placeholder="选择交给其他插件处理的语言"></label>${button('重新加载主题与语法','reload','palette')}</div><h3>实时预览</h3><div id="settings-preview">${codeFrame()}</div></section>`;
}
function states() {
  const entries = {
    '尚无标注':['从第一处重点开始','选中正文或代码，选择重点、疑问、引用或行动。','查看标注工具栏','open-toolbar'],
    '无匹配':['没有匹配的重点','试试减少筛选条件，或换一个搜索词。','清空筛选','clear-search'],
    '空集合':['这个集合还没有内容','在标注工具栏或卡片菜单中选择“加入集合”。','查看当前笔记','back'],
    '未打开笔记':['先打开一篇笔记','打开笔记后查看其中的重点，也可以直接检索全库。','检索全库','vault'],
    '待定位':['原文位置需要重新绑定','原摘录和批注已保留。在代码中选中新位置后重新绑定。','绑定到当前选区','rebind'],
    '读取失败':['2 篇笔记读取失败','其余 126 篇笔记可继续检索。','重试读取','retry'],
    '处理中':['正在整理摘录…','正在处理完整查询中的 2 条重点。','生成中','busy']
  };
  const [title,description,label,action] = entries[state.empty];
  return `<section class="panel stack"><h2>组件状态</h2><label class="field">状态<select id="empty-state">${Object.keys(entries).map(x=>`<option ${x===state.empty?'selected':''}>${x}</option>`).join('')}</select></label><div class="empty"><div class="empty-icon">${icon(state.empty==='待定位'?'question':'search')}</div><h3>${title}</h3><small>${description}</small>${state.empty==='待定位'?'<pre><code>Math.min(count, buffer.length)</code></pre>':''}<button data-action="${action}" ${action==='busy'?'disabled':''}>${label}</button></div><div class="divider"></div><div class="row">${button('默认','state-example')}${button('已选中','state-example',null,'primary')}<button disabled>处理中</button></div><small>Tab 查看焦点；悬停查看按钮与卡片状态。</small></section>`;
}
function render() {
  document.documentElement.dataset.theme=state.theme;
  document.getElementById('stage').style.setProperty('--canvas-width',`${state.width}px`);
  document.getElementById('theme').value=state.theme; document.getElementById('width').value=String(state.width);
  document.getElementById('scenes').innerHTML=Object.entries(scenes).map(([key,label])=>`<button aria-pressed="${state.scene===key}" data-scene="${key}">${label}</button>`).join('');
  const views = { workbench, toolbar, annotation, excerpt, settings, states, code:()=>`<section class="panel stack"><div class="panel-head"><h2>代码展示</h2></div>${codeFrame()}${codeFrame('terminal')}${codeFrame('diff')}</section>`, workspace:()=>`<div class="workspace"><article class="note"><div class="breadcrumbs">计算机基础 / 操作系统 / 内存管理</div><h1>多线程缓冲区的边界检查与资源释放</h1><p>输入校验需要覆盖整个调用链。<mark>检查调用方约束与实际缓冲区长度</mark>，让每一次读取都有明确的边界。</p><h2>边界检查</h2>${codeFrame()}<p>行内表达式 <code><mark>buffer.length</mark></code> 也可以加入同一个集合，和正文、代码块一起整理。</p></article>${workbench()}</div>` };
  document.getElementById('stage').innerHTML=views[state.scene]();
  if(state.scene==='annotation') document.getElementById('annotation-input').value=state.draft;
  if(state.scene==='excerpt') {
    const parts=sampleHits().map(index=>index===0 ? '应同时考虑调用方约束与实际缓冲区长度。' : 'const end = Math.min(count, buffer.length);');
    const origin='来源：[[多线程缓冲区的边界检查与资源释放#边界检查]]';
    const note=sampleHits().includes(1)?'批注：'+state.savedNote:'';
    const plain=[...parts,note,origin].filter(Boolean).join('\n\n');
    const text={markdown:'## 边界检查\n\n'+sampleHits().map(index=>index===0?parts[0]:'```ts\nconst end = Math.min(count, buffer.length);\n```').join('\n\n')+'\n\n'+[note,origin].filter(Boolean).join('\n\n'),plain,quote:plain.split('\n').map(line=>'> '+line).join('\n'),code:sampleHits().map(index=>'```'+(index===0?'text':'ts')+'\n'+(index===0?'应同时考虑调用方约束与实际缓冲区长度。':'const end = Math.min(count, buffer.length);')+'\n```').join('\n\n')+'\n\n'+[note,origin].filter(Boolean).join('\n\n')};
    document.getElementById('export-preview').textContent=text[state.template];
  }
  applySettings();
  updateResults();
}
function sampleHits() {
  const samples=[{类型:'正文',语义:'重点',颜色:'黄色',语言:'',路径:sourcePath,text:'检查输入边界时，应同时考虑调用方约束与实际缓冲区长度。'}, {类型:'代码',语义:'疑问',颜色:'橙色',语言:'TypeScript',路径:sourcePath,text:'Math.min(count, buffer.length) '+state.savedNote}];
  return samples.flatMap((sample,index)=>{
    const matches=Object.entries(state.activeFilters).every(([key,value])=>!value||(key==='路径'?sample[key].includes(value):sample[key]===value));
    return matches&&(!state.search||Object.values(sample).join(' ').toLowerCase().includes(state.search.toLowerCase()))?[index]:[];
  });
}
function updateResults() {
  const hits=sampleHits();
  [...document.querySelectorAll('.results .card')].forEach((card,index)=>{card.hidden=!hits.includes(index);});
  const summary=document.getElementById('result-count');if(summary)summary.textContent=`${hits.length} 条重点`;
}
function applySettings() {
  const preview=document.getElementById('settings-preview'); if(!preview)return;
  preview.classList.toggle('no-numbers',!state.numbers); preview.classList.toggle('wrapped',state.wrap);
  preview.querySelector('.code-header').hidden=state.frame==='none';
  if(state.frame==='terminal') preview.querySelector('.code-title').textContent='终端';
  document.getElementById('setting-frame').value=state.frame;
}
function say(text) {document.getElementById('feedback').textContent=text;}
function go(scene) {state.scene=scene; render();}
document.addEventListener('click',event=>{
  const target=event.target.closest('button'); if(!target||target.disabled)return;
  if(target.dataset.scene){go(target.dataset.scene);return;}
  if(target.dataset.scope){state.scope=target.dataset.scope;render();return;}
  if(target.dataset.semantic){state.semantic=target.dataset.semantic;state.selected=true;render();say(`已标记为${state.semantic}`);return;}
  const action=target.dataset.action;
  if(action==='toggle-filters'){state.filters=!state.filters;render();}
  else if(action==='workbench-menu'){const menu=document.getElementById('workbench-menu');menu.hidden=!menu.hidden;}
  else if(action==='clear-filter'){delete state.activeFilters[target.dataset.key];render();say('已移除筛选条件');}
  else if(action==='item-menu'){const menu=target.closest('.card').querySelector('.item-menu');menu.className='item-menu menu';menu.hidden=!menu.hidden;menu.innerHTML=button('加入集合','collection-menu','folder')+button('修改语义','open-toolbar','pen')+button('修改颜色','color-menu','palette')+button('移除标注','remove','close');}
  else if(action==='annotate'){focusReturn=state.scene;state.draft=state.savedNote;go('annotation');document.getElementById('annotation-input').focus();}
  else if(action==='save-note'){state.savedNote=state.draft;go(focusReturn??'workbench');say('批注已保存');}
  else if(action==='cancel-note'||action==='close-panel'){state.draft=state.savedNote;go(focusReturn??'workbench');say('已返回');}
  else if(action==='open-excerpt'){focusReturn=state.scene;go('excerpt');}
  else if(action==='locate'){state.selected=true;say('已定位到原文第 21 行');go('workspace');}
  else if(action==='collapse-code'){const body=target.closest('.code-frame').querySelector('.code-content');body.hidden=!body.hidden;target.setAttribute('aria-expanded',String(!body.hidden));target.setAttribute('aria-label',body.hidden?'展开代码':'折叠代码');}
  else if(action==='copy-code'||action==='copy-excerpt'||action==='copy-export'){target.innerHTML=icon('check')+'已复制';say('示例摘录已复制');}
  else if(action==='copy-menu'){const parent=target.closest('.code-frame');let menu=parent.querySelector('.copy-menu');if(menu){menu.remove();return;}menu=document.createElement('div');menu.className='copy-menu menu';menu.innerHTML=button('复制原始 diff','copy-code','copy')+button('复制变更片段','copy-code','copy');parent.querySelector('.code-header').after(menu);}
  else if(action==='collection-menu'){let menu=document.getElementById('toolbar-menu');if(!menu){menu=target.closest('.card')?.querySelector('.item-menu');}if(menu){menu.hidden=false;menu.innerHTML='<strong class="muted">加入集合</strong>'+button('阅读摘录','join-collection','folder')+button('代码审阅','join-collection','folder');}}
  else if(action==='join-collection'){state.collection=true;target.innerHTML=icon('check')+'已加入';say('已加入集合');}
  else if(action==='color-menu'){const menu=document.getElementById('toolbar-menu')??target.closest('.card')?.querySelector('.item-menu');if(menu){menu.hidden=false;menu.innerHTML='<div class="row">'+['黄色','橙色','蓝色','紫色','绿色','粉色'].map(c=>button(c,'choose-color')).join('')+'</div>';}}
  else if(action==='choose-color'){target.setAttribute('aria-pressed','true');say('颜色已更新，语义保持不变');}
  else if(action==='line-mode'||action==='precision'){for(const b of target.parentElement.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b===target));say(action==='line-mode'?'将标记第 21 行':'将标记精确选区');}
  else if(action==='open-toolbar')go('toolbar');
  else if(action==='vault'){state.scope='全库';go('workbench');}
  else if(action==='clear-search'||action==='back'){state.search='';go('workbench');}
  else if(action==='remove'){say('已移除当前标注');}
  else if(action==='generate'){say('示例：已生成 Highlight Boost/边界检查摘录.md');}
  else if(action==='new-collection'){say('示例：新建集合入口');}
  else if(action==='retry'||action==='rebuild'||action==='reload'||action==='rebind')say({retry:'读取完成',rebuild:'索引已更新',reload:'主题与语法已重新加载',rebind:'已绑定到当前选区'}[action]);
});
document.addEventListener('input',event=>{
  if(event.target.id==='annotation-input'){state.draft=event.target.value;document.getElementById('draft-status').textContent='未保存';}
  if(event.target.dataset.filter==='路径'){state.activeFilters['路径']=event.target.value;updateResults();}
  if(event.target.matches('.search-box input')){state.search=event.target.value;updateResults();}
});
document.addEventListener('change',event=>{
  if(event.target.dataset.filter){state.activeFilters[event.target.dataset.filter]=event.target.value;render();return;}
  const id=event.target.id;
  if(id==='theme'){state.theme=event.target.value;render();}
  if(id==='width'){state.width=Number(event.target.value);render();}
  if(id==='toolbar-kind'){state.toolbarKind=event.target.value;render();}
  if(id==='template'){state.template=event.target.value;render();}
  if(id==='empty-state'){state.empty=event.target.value;render();}
  if(id==='setting-numbers'){state.numbers=event.target.checked;applySettings();}
  if(id==='setting-wrap'){state.wrap=event.target.checked;applySettings();}
  if(id==='setting-frame'){state.frame=event.target.value;render();}
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&['annotation','excerpt'].includes(state.scene)){state.draft=state.savedNote;go(focusReturn??'workbench');}
  const toolbar=event.target.closest('[role="toolbar"]');if(!toolbar)return;
  const buttons=[...toolbar.querySelectorAll('button')], index=buttons.indexOf(event.target);
  const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:['ArrowRight','ArrowDown'].includes(event.key)?(index+1)%buttons.length:['ArrowLeft','ArrowUp'].includes(event.key)?(index+buttons.length-1)%buttons.length:-1;
  if(next>=0){event.preventDefault();buttons[next].focus();}
});
window.designPreview = { set(next){Object.assign(state,next);render();}, get(){return {...state};}, scenes:Object.keys(scenes) };
render();
