import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { categoryById, STATUS_META, type IssueStatus } from './civic';
import { filterSummary, METHODOLOGY, type ReportSnapshot } from './report-snapshot';
import { resolutionRate } from './transparency';

// Publication palette mirrors Siddi's semantic ink, primary and secondary tokens.
export const REPORT_THEME = { ink: '172D45', primary: '157D82', muted: '526577', paper: 'FFFFFF', soft: 'EDF5F5', warning: 'BE851B' };
export const reportLabel = (dimension: string, key: string, label: string) => dimension === 'category' ? categoryById(key)?.label ?? label : dimension === 'status' ? STATUS_META[key as IssueStatus]?.label ?? label : label;
function metricRows(r: ReportSnapshot): (string | number)[][] {
  const s = r.summary;
  return [['Filtered records',s.total],['Active',s.active],['Resolved / closed',s.resolved],['Citizen-confirmed',s.citizen_confirmed],['Awaiting acknowledgement',s.awaiting_acknowledgement],['In progress',s.in_progress],['Awaiting verification',s.awaiting_verification],['Reopened',s.reopened],['Overdue',s.overdue],['Unassigned',s.unassigned],['Routing exceptions',s.routing_exceptions],['Linked duplicate records',s.linked_duplicates],['Response sample count',s.response_samples],['Mean response (hours)',s.average_response_hours ?? 'Not measured'],['Resolution sample count',s.resolution_samples],['Mean resolution (days)',s.average_resolution_days ?? 'Not measured'],['Resolution rate (%)',resolutionRate(s) ?? 'Undefined (zero denominator)']];
}
export async function buildReportPdf(r: ReportSnapshot, id: string, fontBytes: Uint8Array) {
  const doc = await PDFDocument.create(); doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  const color = (hex: string) => rgb(parseInt(hex.slice(0,2),16)/255,parseInt(hex.slice(2,4),16)/255,parseInt(hex.slice(4,6),16)/255);
  let page = doc.addPage([595,842]); let y = 790;
  const line = (text: string, size=10, tone=REPORT_THEME.ink) => {
    const words = text.split(/\s+/); let current = '';
    for (const word of words) { const next = current ? `${current} ${word}` : word; if (font.widthOfTextAtSize(next,size)>495 && current) { draw(current,size,tone); current=word; } else current=next; }
    if (current) draw(current,size,tone);
  };
  const draw = (text: string,size:number,tone:string) => { if(y<65) { page=doc.addPage([595,842]); y=790; } page.drawText(text,{x:50,y,size,font,color:color(tone)}); y-=size*1.55; };
  const heading = (text:string) => { y-=16; line(text,18); y-=8; };
  const next = () => { page=doc.addPage([595,842]); y=790; };
  doc.setTitle('Siddi civic intelligence report'); doc.setAuthor('Siddi');
  line('Siddi',38); line('Your City. Your Voice.',12,REPORT_THEME.primary); y-=30;
  line('Civic intelligence report',26); y-=18;
  line(r.scope,12); line(`Export ${id}`,10); line(`Snapshot ${new Date(r.generated_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST`,10);
  heading('Applied scope'); line(filterSummary(r.filters),10);
  heading('Executive summary');
  line(`${r.summary.total.toLocaleString('en-IN')} records match the selected filters. ${r.summary.active} remain active; ${r.summary.resolved} are resolved or closed. ${r.summary.citizen_confirmed} have recorded citizen confirmation.`,12);
  line(`${r.summary.overdue} active records are past their recorded ETA or Siddi target. These figures reflect Siddi's recorded workload, not all real-world incidents or an officer performance score.`,11);
  heading('Key measures');
  for(const row of metricRows(r)) line(`${row[0]}: ${row[1]}`,10);
  next();
  for(const dimension of ['category','status','severity','ward','corporation']) {
    const needed=80+r.groups.filter(g=>g.dimension===dimension).length*75;
    if(y<Math.min(needed,500))next();
    heading(`Reports by ${dimension}`);
    const groups=r.groups.filter(g=>g.dimension===dimension); const max=Math.max(1,...groups.map(g=>g.total));
    if(!groups.length) { line('No records in this scope. No chart can be calculated.'); continue; }
    for(const g of groups) {
      if(y<145) { next(); heading(`Reports by ${dimension} (continued)`); }
      line(reportLabel(dimension,g.key,g.label),11);
      page.drawRectangle({x:50,y:y-13,width:445,height:13,color:color(REPORT_THEME.soft)});
      page.drawRectangle({x:50,y:y-13,width:445*g.total/max,height:13,color:color(REPORT_THEME.primary)}); y-=32;
      line(`${g.total} records | ${g.active} active | ${g.resolved} resolved | ${g.overdue} overdue`,9,REPORT_THEME.muted); y-=10;
    }
  }
  if(y<300)next(); heading('Submission trend');
  line('Daily cohorts in IST. Resolved = current resolved/closed from that cohort.');
  for(const t of r.trend) line(`${t.period}: ${t.reports} submitted | ${t.resolved} currently resolved`,10);
  if(!r.trend.length) line('No reporting dates available.');
  heading('Category and status table');
  for(const m of r.matrix) line(`${categoryById(m.category)?.label} | ${STATUS_META[m.status as IssueStatus]?.label ?? m.status}: ${m.count}`,10);
  next(); heading('Methodology and limitations'); for(const note of METHODOLOGY) { line(note,11); y-=12; }
  for(const [index,p] of doc.getPages().entries()) p.drawText(`Siddi | ${id} | Page ${index+1} of ${doc.getPageCount()}`,{x:50,y:30,size:8,font,color:color(REPORT_THEME.muted)});
  return new Blob([new Uint8Array(await doc.save())],{type:'application/pdf'});
}
function xml(text: string) { return text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }
/** ExcelJS omits charts; attach native OOXML chart parts, not chart screenshots. */
export async function buildReportWorkbook(r: ReportSnapshot,id:string) {
  const book=new ExcelJS.Workbook(); book.creator='Siddi'; book.created=new Date(r.generated_at);
  const chartSheets: {sheet:number;rows:number;title:string}[]=[];
  function sheet(name:string,headers:string[],rows:unknown[][]) {
    const s=book.addWorksheet(name,{views:[{state:'frozen',ySplit:1}],pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:1'}}); s.addRow(headers); rows.forEach(row=>s.addRow(row));
    s.getRow(1).font={bold:true,color:{argb:REPORT_THEME.paper},name:'Arial'}; s.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:REPORT_THEME.ink}};
    s.columns.forEach((c,i)=>{c.width=i===0?46:24;}); s.autoFilter={from:'A1',to:{row:Math.max(1,s.rowCount),column:headers.length}};
    s.eachRow((row,index)=>{if(index>1)row.font={name:'Arial',size:11};row.alignment={vertical:'top',wrapText:true};row.eachCell(cell=>{if(typeof cell.value==='number')cell.numFmt='#,##0.0;(#,##0.0);"-"';if(cell.value instanceof Date)cell.numFmt='yyyy-mm-dd hh:mm';});});
    return s;
  }
  sheet('Executive Summary',['Measure','Value'],[['Export ID',id],['Snapshot UTC',new Date(r.generated_at)],['Scope',r.scope],['Filters',filterSummary(r.filters)],...metricRows(r)]);
  for(const [dim,name] of [['category','Category Analysis'],['status','Status Analysis'],['severity','Severity Analysis'],['ward','Ward Analysis'],['corporation','Jurisdiction Analysis']] as const) {
    const rows=r.groups.filter(g=>g.dimension===dim).map(g=>[reportLabel(dim,g.key,g.label),g.total,g.active,g.resolved,g.overdue]);
    const s=sheet(name,['Area / classification','Records','Active','Resolved','Overdue'],rows);
    if(rows.length)chartSheets.push({sheet:s.id,rows:rows.length,title:`Reports by ${dim}`});
  }
  sheet('Trend Analysis',['Submission day IST','Records','Currently resolved cohort'],r.trend.map(t=>[new Date(`${t.period}T00:00:00Z`),t.reports,t.resolved]));
  sheet('Resolution Performance',['Measure','Value'],metricRows(r));
  sheet('Category by Status',['Category','Status','Records'],r.matrix.map(m=>[categoryById(m.category)?.label,STATUS_META[m.status as IssueStatus]?.label??m.status,m.count]));
  sheet('Methodology',['Definition'],METHODOLOGY.map(n=>[n]));
  const zip=await JSZip.loadAsync(await book.xlsx.writeBuffer());
  let types=await zip.file('[Content_Types].xml')?.async('string'); if(!types)throw new Error('Workbook manifest missing');
  for(const [index,c] of chartSheets.entries()) {
    const n=index+1;const s=book.getWorksheet(c.sheet);if(!s)continue;
    const category=r.groups.filter(g=>s.name.startsWith('Category')?g.dimension==='category':s.name.startsWith('Status')?g.dimension==='status':s.name.startsWith('Severity')?g.dimension==='severity':s.name.startsWith('Ward')?g.dimension==='ward':g.dimension==='corporation');
    const labels=category.map(g=>reportLabel(g.dimension,g.key,g.label));
    const catCache=labels.map((v,i)=>`<c:pt idx="${i}"><c:v>${xml(v)}</c:v></c:pt>`).join('');const numCache=category.map((v,i)=>`<c:pt idx="${i}"><c:v>${v.total}</c:v></c:pt>`).join('');
    zip.file(`xl/charts/chart${n}.xml`,`<?xml version="1.0" encoding="UTF-8"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart><c:plotArea><c:layout/><c:barChart><c:barDir val="bar"/><c:grouping val="clustered"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>${xml(c.title)}</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="${REPORT_THEME.primary}"/></a:solidFill></c:spPr><c:cat><c:strRef><c:f>'${xml(s.name)}'!$A$2:$A$${c.rows+1}</c:f><c:strCache><c:ptCount val="${c.rows}"/>${catCache}</c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>'${xml(s.name)}'!$B$2:$B$${c.rows+1}</c:f><c:numCache><c:formatCode>0</c:formatCode><c:ptCount val="${c.rows}"/>${numCache}</c:numCache></c:numRef></c:val></c:ser><c:axId val="${100+n}"/><c:axId val="${200+n}"/></c:barChart><c:catAx><c:axId val="${100+n}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="l"/><c:crossAx val="${200+n}"/><c:tickLblPos val="nextTo"/></c:catAx><c:valAx><c:axId val="${200+n}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:crossAx val="${100+n}"/><c:numFmt formatCode="0" sourceLinked="0"/><c:tickLblPos val="nextTo"/></c:valAx></c:plotArea><c:plotVisOnly val="1"/></c:chart></c:chartSpace>`);
    zip.file(`xl/drawings/drawing${n}.xml`,`<?xml version="1.0" encoding="UTF-8"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor><xdr:from><xdr:col>6</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>17</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>22</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${n}" name="${xml(c.title)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`);
    zip.file(`xl/drawings/_rels/drawing${n}.xml.rels`,`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${n}.xml"/></Relationships>`);
    zip.file(`xl/worksheets/_rels/sheet${c.sheet}.xml.rels`,`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdSiddiChart" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${n}.xml"/></Relationships>`);
    const part=zip.file(`xl/worksheets/sheet${c.sheet}.xml`); if(!part)throw new Error('Worksheet missing');
    zip.file(`xl/worksheets/sheet${c.sheet}.xml`,(await part.async('string')).replace('</worksheet>','<drawing r:id="rIdSiddiChart"/></worksheet>'));
    types=types.replace('</Types>',`<Override PartName="/xl/charts/chart${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/><Override PartName="/xl/drawings/drawing${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
  }
  zip.file('[Content_Types].xml',types);
  return new Blob([new Uint8Array(await zip.generateAsync({type:'uint8array'}))],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
export function downloadReport(blob:Blob,name:string) {const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}