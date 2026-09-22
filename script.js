(function(){
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'change_orders_v1';
  const COUNTER_KEY = 'change_order_counter_v1';

  let photos = []; // {dataUrl}
  let currentId = null;

  // ---------- date default ----------
  function todayStr(){
    const d = new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  $('coDate').value = todayStr();

  // ---------- storage helpers ----------
  function safeGet(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){ return fallback; }
  }
  function safeSet(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch(e){ console.error('storage failed', e); return false; }
  }

  function nextCoNumber(){
    let n = safeGet(COUNTER_KEY, 0);
    n = n + 1;
    safeSet(COUNTER_KEY, n);
    return 'TKT-' + String(n).padStart(4,'0');
  }
  if(!$('coNumber').value){
    $('coNumber').value = nextCoNumber();
    // roll back counter until actually saved, so re-loading the page doesn't burn numbers
    safeSet(COUNTER_KEY, safeGet(COUNTER_KEY,1)-1);
  }

  // ---------- chip groups ----------
  function setupChips(containerId){
    const container = $(containerId);
    container.addEventListener('click', (e)=>{
      const chip = e.target.closest('.chip');
      if(!chip) return;
      const wasActive = chip.classList.contains('active');
      [...container.children].forEach(c=>c.classList.remove('active'));
      if(!wasActive) chip.classList.add('active');
    });
  }
  setupChips('reasonChips');
  setupChips('costTypeChips');

  function getActiveChip(containerId){
    const el = $(containerId).querySelector('.chip.active');
    return el ? el.dataset.value : '';
  }
  function setActiveChip(containerId, value){
    const container = $(containerId);
    [...container.children].forEach(c=>{
      c.classList.toggle('active', c.dataset.value === value);
    });
  }

  // ---------- photos ----------
  $('takePhotoBtn').addEventListener('click', ()=> $('photoInput').click());

  $('photoInput').addEventListener('change', (e)=>{
    const files = [...e.target.files];
    files.forEach(file=>{
      const reader = new FileReader();
      reader.onload = (ev)=>{
        photos.push(ev.target.result);
        renderPhotos();
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  });

  function renderPhotos(){
    const grid = $('photoGrid');
    grid.innerHTML = '';
    photos.forEach((src, idx)=>{
      const div = document.createElement('div');
      div.className = 'photo-thumb';
      div.innerHTML = '<img src="'+src+'"><button data-idx="'+idx+'">✕</button>';
      grid.appendChild(div);
    });
  }
  $('photoGrid').addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;
    photos.splice(Number(btn.dataset.idx), 1);
    renderPhotos();
  });

  // ---------- signature pad ----------
  const canvas = $('sigPad');
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let hasSignature = false;
  let last = {x:0,y:0};

  function resizeCanvas(){
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const imgData = hasSignature ? canvas.toDataURL() : null;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('color') || '#111';
    if(imgData){
      const img = new Image();
      img.onload = ()=> ctx.drawImage(img,0,0, rect.width, rect.height);
      img.src = imgData;
    }
  }
  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 50);

  function getPos(e){
    const rect = canvas.getBoundingClientRect();
    if(e.touches && e.touches.length){
      return {x: e.touches[0].clientX-rect.left, y: e.touches[0].clientY-rect.top};
    }
    return {x: e.clientX-rect.left, y: e.clientY-rect.top};
  }
  function start(e){
    drawing = true;
    hasSignature = true;
    last = getPos(e);
    $('sigStatus').textContent = 'Signature captured';
    e.preventDefault();
  }
  function move(e){
    if(!drawing) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    last = pos;
    e.preventDefault();
  }
  function end(e){ drawing = false; }

  canvas.addEventListener('touchstart', start, {passive:false});
  canvas.addEventListener('touchmove', move, {passive:false});
  canvas.addEventListener('touchend', end);
  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);

  $('clearSigBtn').addEventListener('click', ()=>{
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0,0,rect.width,rect.height);
    hasSignature = false;
    $('sigStatus').textContent = 'Sign above with your finger';
  });

  // ---------- form collection ----------
  function collectForm(){
    return {
      id: currentId || ('id_'+Date.now()),
      projectName: $('projectName').value.trim(),
      coNumber: $('coNumber').value.trim(),
      coDate: $('coDate').value,
      clientName: $('clientName').value.trim(),
      siteAddress: $('siteAddress').value.trim(),
      description: $('description').value.trim(),
      reason: getActiveChip('reasonChips'),
      notes: $('notes').value.trim(),
      costImpact: $('costImpact').value,
      scheduleImpact: $('scheduleImpact').value,
      costType: getActiveChip('costTypeChips'),
      photos: photos.slice(),
      signature: hasSignature ? canvas.toDataURL() : null,
      signerName: $('signerName').value.trim(),
      signerTitle: $('signerTitle').value.trim(),
      savedAt: new Date().toISOString()
    };
  }

  function loadForm(data){
    currentId = data.id;
    $('projectName').value = data.projectName||'';
    $('coNumber').value = data.coNumber||'';
    $('coDate').value = data.coDate||todayStr();
    $('clientName').value = data.clientName||'';
    $('siteAddress').value = data.siteAddress||'';
    $('description').value = data.description||'';
    setActiveChip('reasonChips', data.reason||'');
    $('notes').value = data.notes||'';
    $('costImpact').value = data.costImpact||'';
    $('scheduleImpact').value = data.scheduleImpact||'';
    setActiveChip('costTypeChips', data.costType||'');
    photos = (data.photos||[]).slice();
    renderPhotos();
    $('signerName').value = data.signerName||'';
    $('signerTitle').value = data.signerTitle||'';
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0,0,rect.width,rect.height);
    hasSignature = false;
    $('sigStatus').textContent = 'Sign above with your finger';
    if(data.signature){
      const img = new Image();
      img.onload = ()=>{
        ctx.drawImage(img,0,0,rect.width,rect.height);
        hasSignature = true;
        $('sigStatus').textContent = 'Signature captured';
      };
      img.src = data.signature;
    }
  }

  function resetForm(){
    currentId = null;
    $('projectName').value='';
    $('coNumber').value = nextCoNumber();
    safeSet(COUNTER_KEY, safeGet(COUNTER_KEY,1)-1);
    $('coDate').value = todayStr();
    $('clientName').value='';
    $('siteAddress').value='';
    $('description').value='';
    setActiveChip('reasonChips','');
    $('notes').value='';
    $('costImpact').value='';
    $('scheduleImpact').value='';
    setActiveChip('costTypeChips','');
    photos = [];
    renderPhotos();
    $('signerName').value='';
    $('signerTitle').value='';
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0,0,rect.width,rect.height);
    hasSignature = false;
    $('sigStatus').textContent = 'Sign above with your finger';
  }

  // ---------- save / list ----------
  function showStatus(msg){
    const el = $('statusBanner');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(()=> el.classList.remove('show'), 2500);
  }

  function renderSavedList(){
    const list = safeGet(STORAGE_KEY, []);
    const container = $('savedList');
    container.innerHTML = '';
    if(!list.length){
      container.innerHTML = '<div class="empty-note">No change orders saved yet.</div>';
      return;
    }
    list.slice().reverse().forEach(item=>{
      const row = document.createElement('div');
      row.className = 'saved-item';
      const dateStr = item.coDate || '';
      row.innerHTML = '<div><strong>'+(item.coNumber||'—')+'</strong> · '+(item.projectName||'Untitled')+
        '<div class="meta">'+dateStr+(item.signerName? ' · signed by '+item.signerName:' · unsigned')+'</div></div>'+
        '<div><span class="btn small" data-act="open" data-id="'+item.id+'">Open</span> '+
        '<span class="btn small ghost" data-act="del" data-id="'+item.id+'">Del</span></div>';
      container.appendChild(row);
    });
  }
  $('savedList').addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-act]');
    if(!btn) return;
    const list = safeGet(STORAGE_KEY, []);
    const item = list.find(i=>i.id===btn.dataset.id);
    if(btn.dataset.act==='open' && item){
      loadForm(item);
      window.scrollTo({top:0, behavior:'smooth'});
    } else if(btn.dataset.act==='del'){
      const filtered = list.filter(i=>i.id!==btn.dataset.id);
      safeSet(STORAGE_KEY, filtered);
      renderSavedList();
    }
  });

  $('saveBtn').addEventListener('click', ()=>{
    if(!$('projectName').value.trim()){
      alert('Please enter a project name.');
      return;
    }
    if(!$('description').value.trim()){
      alert('Please describe the change.');
      return;
    }
    const data = collectForm();
    currentId = data.id;
    let list = safeGet(STORAGE_KEY, []);
    const idx = list.findIndex(i=>i.id===data.id);
    if(idx>=0) list[idx]=data; else list.push(data);
    const ok = safeSet(STORAGE_KEY, list);
    if(ok){
      showStatus('✅ Saved '+(data.coNumber||''));
      renderSavedList();
      clearDraft();
    } else {
      showStatus('⚠️ Could not save — storage full?');
    }
  });

  $('newBtn').addEventListener('click', ()=>{
    if(confirm('Start a new blank change order? Unsaved changes will be lost.')){
      resetForm();
    }
  });

  // ---------- text this form to someone ----------
  const FORM_URL = 'https://claude.ai/artifact/6uqX6VMbbTMHn55zNQKVkk';

  $('shareBlankBtn').addEventListener('click', async ()=>{
    const message = 'Freddy & Son change order form: ' + FORM_URL;

    // Try the native share sheet first (works in Safari, most apps)
    try{
      if(navigator.share){
        await navigator.share({ title: 'Freddy & Son — Change Order Form', text: message });
        return;
      }
    }catch(e){
      // if the user cancels, navigator.share rejects — don't chain into fallbacks below
      if(e && e.name === 'AbortError') return;
    }

    // Fallback: open the Messages app directly with the text pre-filled
    try{
      window.location.href = 'sms:&body=' + encodeURIComponent(message);
      return;
    }catch(e){ /* fall through */ }

    // Last resort: copy to clipboard
    try{
      await navigator.clipboard.writeText(message);
      showStatus('🔗 Link copied — paste it into your message');
    }catch(e){
      window.prompt('Copy this to text the form:', message);
    }
  });

  // ---------- export / print summary ----------
  function buildPrintable(data){
    const photosHtml = (data.photos||[]).map(p=>'<img src="'+p+'" style="width:100%;max-width:220px;border-radius:8px;margin:4px;border:1px solid #ccc;">').join('');

    const costAmount = parseFloat(data.costImpact);
    const hasCostAmount = !isNaN(costAmount) && costAmount !== 0;
    const costValue = data.costType==='Yes'
      ? 'Yes' + (hasCostAmount ? ' ($'+data.costImpact+')' : ' (TBD)')
      : (data.costType || '—');

    const scheduleAmount = parseFloat(data.scheduleImpact);
    const hasScheduleAmount = !isNaN(scheduleAmount) && scheduleAmount !== 0;
    const scheduleValue = hasScheduleAmount ? (data.scheduleImpact+' day(s)') : 'TBD';

    return '' +
    '<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#111;">' +
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">' +
    '<img src="logo.jpg" alt="Freddy & Son logo" style="width:60px;height:60px;object-fit:contain;">' +
    '<div><div style="font-weight:800;font-size:1.05rem;">Freddy &amp; Son</div></div>' +
    '</div>' +
    '<h1 style="margin-bottom:0;">Change Order Ticket Form</h1>' +
    '<p style="color:#666;margin-top:4px;">'+ (data.coNumber||'') +' &middot; '+(data.coDate||'')+'</p>' +
    '<hr>' +
    '<p><strong>Project:</strong> '+(data.projectName||'')+'</p>' +
    '<p><strong>Client / Owner:</strong> '+(data.clientName||'')+'</p>' +
    '<p><strong>Site address:</strong> '+(data.siteAddress||'')+'</p>' +
    '<p><strong>Description of change:</strong><br>'+(data.description||'').replace(/\n/g,'<br>')+'</p>' +
    '<p><strong>Reason:</strong> '+(data.reason||'—')+'</p>' +
    (data.notes? '<p><strong>Notes:</strong><br>'+data.notes.replace(/\n/g,'<br>')+'</p>' : '') +
    '<p><strong>Cost impact:</strong> '+costValue+'</p>' +
    '<p><strong>Schedule impact:</strong> '+scheduleValue+'</p>' +
    (photosHtml? '<p><strong>Photos:</strong></p><div>'+photosHtml+'</div>' : '') +
    '<p style="margin-top:24px;"><strong>Signed by:</strong> '+(data.signerName||'')+' ('+(data.signerTitle||'')+')</p>' +
    (data.signature? '<img src="'+data.signature+'" style="max-width:280px;border-bottom:1px solid #333;">' : '<p style="color:#999;">No signature captured</p>') +
    '<p style="color:#999;font-size:12px;margin-top:24px;">Saved '+(data.savedAt||'')+'</p>' +
    '</div>';
  }

  function preparePrintArea(data){
    const printArea = $('printArea');
    printArea.innerHTML = buildPrintable(data);
    printArea.style.display = 'block';
    printArea.style.position = 'static';
    printArea.style.width = '100%';
    printArea.style.margin = '0';
    printArea.style.padding = '0';
    return printArea;
  }

 $('exportBtn').addEventListener('click', ()=>{
  const data = collectForm();
  const printArea = preparePrintArea(data);
  function HideAfterPrint(){
    printArea.style.display = 'none';
    printArea.style.position = '';
    printArea.style.width = '';
    printArea.style.margin = '';
    printArea.style.padding = '';
    window.removeEventListener('afterprint', HideAfterPrint);
  }
  window.addEventListener('afterprint', HideAfterPrint);
  setTimeout(()=>{
    window.print();
  }, 100);
});

  $('exportPdfBtn').addEventListener('click', async ()=>{
    const btn = $('exportPdfBtn');
    const originalLabel = btn.textContent;
    btn.textContent = '⏳ Building PDF...';
    btn.disabled = true;

    const data = collectForm();
    const printArea = preparePrintArea(data);

    try{
      // give embedded images a moment to paint
      await new Promise(r=> setTimeout(r, 200));

      if(typeof html2canvas !== 'function' || !window.jspdf){
        throw new Error('pdf libraries unavailable');
      }

      const canvas = await html2canvas(printArea, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.92);

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const imgWidth = pageWidth - margin*2;
      const imgHeight = canvas.height * imgWidth / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;
      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - margin*2);

      while(heightLeft > 0){
        position = margin - (imgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - margin*2);
      }

      const blob = pdf.output('blob');
      const filename = (data.coNumber || 'change-order').replace(/[^a-z0-9\-_]/gi,'_') + '.pdf';

      let downloads = null;
      try{
        if(window.claude && typeof window.claude.use === 'function'){
          downloads = await window.claude.use('downloads');
        }
      }catch(e){ downloads = null; }

      if(downloads){
        try{
          const result = await downloads.save({ filename, data: blob });
          if(result && result.status){
            showStatus('📄 PDF saved');
          }
        }catch(err){
          if(err && err.code === 'declined'){
            // viewer said no — do nothing
          } else if(err && err.code === 'too_large'){
            showStatus('⚠️ PDF too large to save');
          } else {
            console.error('downloads.save failed', err);
            window.print();
          }
        }
      } else {
        // no downloads capability available in this view — fall back to print,
        // which lets the viewer "Save as PDF" from the share/print sheet
        window.print();
      }
    } catch(e){
      console.error('PDF export failed', e);
      window.print();
    } finally {
      printArea.style.display = 'none';
      btn.textContent = originalLabel;
      btn.disabled = false;
    }
  });

  // ---------- init ----------
  const DRAFT_KEY = 'change_order_draft_v1';
  let draftTimer = null;

  function saveDraft(){
    try{
      const data = collectForm();
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    }catch(e){ /* storage full or unavailable — ignore, saving is best-effort */ }
  }

  function scheduleDraftSave(){
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 500);
  }

  function clearDraft(){
    try{ localStorage.removeItem(DRAFT_KEY); }catch(e){}
  }

  function restoreDraftIfAny(){
    let draft = null;
    try{ draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); }catch(e){}
    if(draft && (draft.projectName || draft.description || (draft.photos||[]).length)){
      loadForm(draft);
      showStatus('📝 Restored your unsaved draft');
    }
  }

  // Autosave on any field change, photo change, or signature stroke
  document.querySelectorAll('input, textarea').forEach(el=>{
    el.addEventListener('input', scheduleDraftSave);
    el.addEventListener('change', scheduleDraftSave);
  });
  ['reasonChips','costTypeChips'].forEach(id=>{
    $(id).addEventListener('click', ()=> setTimeout(scheduleDraftSave, 0));
  });
  canvas.addEventListener('mouseup', scheduleDraftSave);
  canvas.addEventListener('touchend', scheduleDraftSave);
  $('photoInput').addEventListener('change', ()=> setTimeout(scheduleDraftSave, 300));
  $('photoGrid').addEventListener('click', scheduleDraftSave);
  $('clearSigBtn').addEventListener('click', scheduleDraftSave);

  // Starting a new form clears any in-progress draft (it's intentionally discarded)
  $('newBtn').addEventListener('click', ()=> setTimeout(clearDraft, 0));

  restoreDraftIfAny();
  renderSavedList();
})();
