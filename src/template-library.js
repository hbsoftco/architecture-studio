import { TYPES, MERMAID_EXAMPLES } from './model.js';
import { TEMPLATE_VERSION, validateTemplateContent } from './template-core.js';

const p = (fa, en) => ({ fa, en });
const xml = value => String(value).replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' })[character]);
const nodeSize = kind => kind.endsWith('Event') ? [36, 36] : kind === 'exclusiveGateway' ? [50, 50] : [150, 80];

function processXML(name, nodes, flows) {
  const incoming = id => flows.filter(flow => flow.to === id).map(flow => `<bpmn:incoming>${xml(flow.id)}</bpmn:incoming>`).join('');
  const outgoing = id => flows.filter(flow => flow.from === id).map(flow => `<bpmn:outgoing>${xml(flow.id)}</bpmn:outgoing>`).join('');
  const semantic = nodes.map(node => `<bpmn:${node.kind} id="${xml(node.id)}" name="${xml(node.name)}">${incoming(node.id)}${outgoing(node.id)}</bpmn:${node.kind}>`).join('');
  const flowXML = flows.map(flow => `<bpmn:sequenceFlow id="${xml(flow.id)}" sourceRef="${xml(flow.from)}" targetRef="${xml(flow.to)}"${flow.name ? ` name="${xml(flow.name)}"` : ''}/>`).join('');
  const shapes = nodes.map(node => { const [w, h] = nodeSize(node.kind); return `<bpmndi:BPMNShape id="${xml(node.id)}_di" bpmnElement="${xml(node.id)}"><dc:Bounds x="${node.x}" y="${node.y}" width="${w}" height="${h}"/></bpmndi:BPMNShape>`; }).join('');
  const edges = flows.map(flow => { const from = nodes.find(node => node.id === flow.from); const to = nodes.find(node => node.id === flow.to); const [fw, fh] = nodeSize(from.kind); const [tw, th] = nodeSize(to.kind); return `<bpmndi:BPMNEdge id="${xml(flow.id)}_di" bpmnElement="${xml(flow.id)}"><di:waypoint x="${from.x + fw}" y="${from.y + fh / 2}"/><di:waypoint x="${to.x}" y="${to.y + th / 2}"/></bpmndi:BPMNEdge>`; }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://architecture.studio/templates"><bpmn:process id="Process_1" name="${xml(name)}" isExecutable="false">${semantic}${flowXML}</bpmn:process><bpmndi:BPMNDiagram id="BPMNDiagram_1"><bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">${shapes}${edges}</bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn:definitions>`;
}

function decisionXML(name, expression, typeRef, output, rules) {
  const rows = rules.map((rule, i) => `<rule id="Rule_${i + 1}"><inputEntry id="InputEntry_${i + 1}"><text>${xml(rule[0])}</text></inputEntry><outputEntry id="OutputEntry_${i + 1}"><text>${xml(rule[1])}</text></outputEntry></rule>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/" xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/" id="Definitions_1" name="${xml(name)}" namespace="http://architecture.studio/templates"><decision id="Decision_1" name="${xml(name)}"><decisionTable id="DecisionTable_1" hitPolicy="UNIQUE"><input id="Input_1" label="${xml(expression)}"><inputExpression id="InputExpression_1" typeRef="${typeRef}"><text>${xml(expression)}</text></inputExpression></input><output id="Output_1" label="${xml(output)}" name="result" typeRef="string"/>${rows}</decisionTable></decision><dmndi:DMNDI><dmndi:DMNDiagram id="DMNDiagram_1"><dmndi:DMNShape id="DMNShape_1" dmnElementRef="Decision_1"><dc:Bounds x="160" y="110" width="200" height="90"/></dmndi:DMNShape></dmndi:DMNDiagram></dmndi:DMNDI></definitions>`;
}

function graphContent(nodes, edges) {
  return JSON.stringify({ schemaVersion: 1, flowDirection: 'ltr', nodes: nodes.map(([id, label, x, y, kind = 'box']) => ({ id, kind, label, x, y, w: 190, h: 94, fill: kind === 'database' ? '#d7eae6' : '#e7f1ee' })), edges: edges.map(([id, from, to, label = '']) => ({ id, from, to, label })) });
}

const bpmnApproval = processXML('Request approval', [
  { id:'Start_1', kind:'startEvent', name:'Request received', x:80, y:190 },
  { id:'Task_Review', kind:'userTask', name:'Review request', x:190, y:170 },
  { id:'Gateway_Approve', kind:'exclusiveGateway', name:'Approved?', x:420, y:185 },
  { id:'Task_Fulfill', kind:'serviceTask', name:'Fulfill request', x:565, y:100 },
  { id:'End_Approved', kind:'endEvent', name:'Approved', x:800, y:122 },
  { id:'End_Rejected', kind:'endEvent', name:'Rejected', x:620, y:320 }
], [
  { id:'Flow_1', from:'Start_1', to:'Task_Review' }, { id:'Flow_2', from:'Task_Review', to:'Gateway_Approve' },
  { id:'Flow_3', from:'Gateway_Approve', to:'Task_Fulfill', name:'Yes' }, { id:'Flow_4', from:'Task_Fulfill', to:'End_Approved' },
  { id:'Flow_5', from:'Gateway_Approve', to:'End_Rejected', name:'No' }
]);
const bpmnRequest = processXML('Service request', [
  { id:'Start_1', kind:'startEvent', name:'Ticket received', x:80, y:180 },
  { id:'Task_Triage', kind:'userTask', name:'Triage ticket', x:190, y:160 },
  { id:'Task_Resolve', kind:'serviceTask', name:'Resolve issue', x:430, y:160 },
  { id:'Task_Notify', kind:'task', name:'Notify requester', x:670, y:160 },
  { id:'End_1', kind:'endEvent', name:'Closed', x:920, y:182 }
], [
  { id:'Flow_1', from:'Start_1', to:'Task_Triage' }, { id:'Flow_2', from:'Task_Triage', to:'Task_Resolve' },
  { id:'Flow_3', from:'Task_Resolve', to:'Task_Notify' }, { id:'Flow_4', from:'Task_Notify', to:'End_1' }
]);
const bpmnException = processXML('Exception handling', [
  { id:'Start_1', kind:'startEvent', name:'Job submitted', x:70, y:185 },
  { id:'Task_Run', kind:'serviceTask', name:'Run job', x:190, y:160 },
  { id:'Gateway_Result', kind:'exclusiveGateway', name:'Successful?', x:420, y:175 },
  { id:'Task_Investigate', kind:'userTask', name:'Investigate failure', x:550, y:290 },
  { id:'End_Success', kind:'endEvent', name:'Completed', x:690, y:185 },
  { id:'End_Failure', kind:'endEvent', name:'Escalated', x:800, y:312 }
], [
  { id:'Flow_1', from:'Start_1', to:'Task_Run' }, { id:'Flow_2', from:'Task_Run', to:'Gateway_Result' },
  { id:'Flow_3', from:'Gateway_Result', to:'End_Success', name:'Yes' }, { id:'Flow_4', from:'Gateway_Result', to:'Task_Investigate', name:'No' },
  { id:'Flow_5', from:'Task_Investigate', to:'End_Failure' }
]);

const raw = [
  ['bpmn-approval','bpmn','process',p('تأیید درخواست','Request approval'),p('بررسی، تأیید یا رد یک درخواست.','Review, approve, or reject a request.'),p('فرایند دارای یک تصمیم روشن و دو نتیجه برای تمرین ویرایش BPMN.','A process with one decision and two outcomes for BPMN editing.'),['approval','workflow','تأیید','فرایند'],'bpmn',bpmnApproval,10],
  ['bpmn-service-request','bpmn','process',p('پردازش درخواست خدمت','Service request'),p('دریافت تیکت تا حل و اطلاع‌رسانی.','Take a ticket through triage, resolution, and notification.'),p('مسیر خطی یک درخواست خدمت با وظیفهٔ انسانی و سیستمی.','A service request path with human and service tasks.'),['ticket','request','service','درخواست'],'bpmn',bpmnRequest,8],
  ['bpmn-exception','bpmn','process',p('رسیدگی به خطا','Exception handling'),p('مسیر موفقیت و بررسی شکست یک کار.','Handle success and failure of a job.'),p('انشعاب نتیجهٔ اجرا و ارجاع خطا به بررسی انسانی.','Branch on execution result and escalate failures to review.'),['exception','failure','escalation','خطا'],'bpmn',bpmnException,7],
  ['dmn-shipping','dmn','decision',p('روش ارسال سفارش','Order shipping method'),p('انتخاب پیک یا پست بر اساس فوریت.','Choose courier or post from urgency.'),p('جدول تصمیم با دو قانون یکتا برای روش ارسال.','A two-rule decision table for shipping method.'),['decision','shipping','urgent','ارسال'],'dmn',decisionXML('Shipping method','urgent','boolean','Method',[['true','"Courier"'],['false','"Post"']]),9],
  ['dmn-eligibility','dmn','decision',p('واجد شرایط بودن','Eligibility decision'),p('تصمیم بر اساس سن متقاضی.','Decide eligibility from applicant age.'),p('قوانین بدون همپوشانی برای یک شرط عددی.','Non-overlapping rules for a numeric condition.'),['eligibility','age','rules','شرایط'],'dmn',decisionXML('Eligibility','age','number','Status',[['< 18','"Not eligible"'],['>= 18','"Eligible"']]),7],
  ['mermaid-flow','mermaid','general',p('جریان اعتبارسنجی','Validation flow'),p('بررسی یک درخواست و مسیر خطا.','Check a request and branch on errors.'),p('فلوچارت متنی برای نشان دادن مسیرهای موفق و ناموفق.','A source flowchart showing success and failure paths.'),['flowchart','validation','فلوچارت'],'flowchart',MERMAID_EXAMPLES.flowchart,9],
  ['mermaid-sequence','mermaid','uml',p('توالی درخواست API','API request sequence'),p('پیام‌های کاربر، رابط و سرویس.','Messages between user, UI, and service.'),p('توالی درخواست و پاسخ برای مستندسازی قرارداد API.','Request and response sequence for an API contract.'),['uml','sequence','api','توالی'],'sequence','sequenceDiagram\n  actor User\n  participant UI as Web App\n  participant API as Order API\n  User->>UI: View orders\n  UI->>API: GET /orders\n  API-->>UI: Orders\n  UI-->>User: Display orders',8],
  ['mermaid-class','mermaid','uml',p('کلاس‌های سفارش','Order classes'),p('رابطهٔ کاربر و سفارش.','User and order relationship.'),p('مدل کلاس کوچک با ویژگی‌ها و چندگانگی ارتباط.','A small class model with properties and multiplicity.'),['uml','class','order','کلاس'],'class','classDiagram\n  class User {\n    +String id\n    +String email\n  }\n  class Order {\n    +String id\n    +String status\n  }\n  User "1" --> "many" Order : places',7],
  ['mermaid-state','mermaid','uml',p('چرخهٔ عمر سفارش','Order lifecycle'),p('حالت‌های ثبت، پرداخت و ارسال.','Placed, paid, and shipped states.'),p('گذارهای اصلی وضعیت سفارش از آغاز تا تکمیل.','Primary order state transitions from start to completion.'),['uml','state','order','حالت'],'state','stateDiagram-v2\n  [*] --> Placed\n  Placed --> Paid : payment received\n  Paid --> Shipped : dispatch\n  Shipped --> [*]',7],
  ['mermaid-activity','mermaid','uml',p('فعالیت ثبت‌نام','Registration activity'),p('گام‌های ثبت‌نام و تأیید ایمیل.','Registration and email confirmation steps.'),p('فعالیت UML به صورت فلوچارت قابل ویرایش Mermaid.','UML activity represented as an editable Mermaid flowchart.'),['uml','activity','registration','فعالیت'],'flowchart','flowchart TD\n  A[Enter details] --> B{Valid email?}\n  B -->|No| C[Show error]\n  C --> A\n  B -->|Yes| D[Send confirmation]\n  D --> E[Activate account]',6],
  ['c4-context','c4','architecture',p('مرز سامانهٔ سفارش','Order system context'),p('کاربر، سامانه و درگاه پرداخت.','User, system, and payment gateway.'),p('نمای مرز سامانه و ارتباطات بیرونی برای شروع بحث C4.','System boundary and external relationships for C4 discussions.'),['c4','context','architecture','معماری'],'c4',graphContent([['user','Customer',80,200],['system','Order System',450,200],['payment','Payment Gateway',820,200]],[['e1','user','system','places order'],['e2','system','payment','charges']]),8],
  ['c4-container','c4','architecture',p('کانتینرهای فروشگاه','Store containers'),p('وب، API و پایگاه دادهٔ فروشگاه.','Web app, API, and store database.'),p('کانتینرهای اصلی و قراردادهای سادهٔ میان آنها.','Core containers and their simple relationships.'),['c4','container','web','api'],'c4',graphContent([['web','Web App',80,200],['api','Order API',450,200],['db','Orders DB',820,200,'database']],[['e1','web','api','HTTPS'],['e2','api','db','SQL']]),7],
  ['c4-events','c4','architecture',p('معماری رویدادمحور','Event-driven services'),p('سفارش، صف رویداد و اعلان.','Orders, event bus, and notifications.'),p('دو سرویس که از طریق صف رویداد با هم ارتباط دارند.','Two services communicating through an event bus.'),['microservices','events','queue','رویداد'],'c4',graphContent([['orders','Order Service',80,200],['bus','Event Bus',450,200],['notify','Notification Service',820,200]],[['e1','orders','bus','OrderPlaced'],['e2','bus','notify','subscribes']]),7],
  ['erd-users-roles','erd','data',p('کاربران و نقش‌ها','Users and roles'),p('جدول کاربر، نقش و عضویت.','Users, roles, and membership entities.'),p('مدل دادهٔ ساده برای دسترسی مبتنی بر نقش.','A simple role-based access data model.'),['erd','database','user','role','داده'],'erd',graphContent([['users','Users · PK id',70,150,'entity'],['members','Memberships · FK user_id · FK role_id',430,150,'entity'],['roles','Roles · PK id',790,150,'entity']],[['e1','users','members','1:N'],['e2','roles','members','1:N']]),8],
  ['erd-commerce','erd','data',p('دادهٔ فروشگاه','E-commerce data'),p('کاربر، سفارش و قلم سفارش.','Customers, orders, and order items.'),p('رابطه‌های اصلی مدل دادهٔ فروشگاه آنلاین.','Core relationships in an online store data model.'),['erd','ecommerce','order','database'],'erd',graphContent([['customer','Customers · PK id',70,150,'entity'],['orders','Orders · PK id · FK customer_id',430,150,'entity'],['items','Order Items · FK order_id',790,150,'entity']],[['e1','customer','orders','1:N'],['e2','orders','items','1:N']]),7],
  ['dfd-order','dfd','data',p('جریان دادهٔ سفارش','Order data flow'),p('انتقال سفارش از مشتری به مخزن.','Move order data from customer to store.'),p('مبدأ، پردازش و مخزن داده در یک مسیر قابل پیگیری.','Source, process, and data store in one traceable path.'),['dfd','data flow','order','جریان داده'],'dfd',graphContent([['customer','Customer',70,180],['process','Process Order',430,180],['store','Orders Store',790,180,'database']],[['e1','customer','process','order'],['e2','process','store','record']]),7],
  ['infra-three-tier','infrastructure','infrastructure',p('استقرار سه‌لایه','Three-tier deployment'),p('وب، برنامه و پایگاه داده.','Web, application, and database tiers.'),p('مسیر درخواست در استقرار سه‌لایه.','Request path through a three-tier deployment.'),['infrastructure','deployment','three-tier','زیرساخت'],'infrastructure',graphContent([['web','Web Tier',70,180,'server'],['app','Application Tier',430,180,'server'],['db','Database Tier',790,180,'database']],[['e1','web','app','HTTP'],['e2','app','db','SQL']]),8],
  ['infra-balanced','infrastructure','infrastructure',p('برنامهٔ متوازن‌شده','Load-balanced app'),p('توزیع درخواست میان دو برنامه.','Distribute traffic across two apps.'),p('باربر و دو نمونهٔ برنامه که به یک مخزن متصل‌اند.','A load balancer and two app instances sharing storage.'),['load balancer','network','availability','شبکه'],'infrastructure',graphContent([['lb','Load Balancer',70,200],['app1','App A',430,90,'server'],['app2','App B',430,310,'server'],['db','Database',800,200,'database']],[['e1','lb','app1'],['e2','lb','app2'],['e3','app1','db'],['e4','app2','db']]),7],
  ['general-workflow','general','general',p('گردش کار پروژه','Project workflow'),p('برنامه‌ریزی، اجرا و بازبینی.','Plan, execute, and review work.'),p('یک گردش کار پایه برای هماهنگی پروژه.','A basic workflow for project coordination.'),['project','workflow','planning','پروژه'],'general',graphContent([['plan','Plan',70,180],['build','Execute',430,180],['review','Review',790,180]],[['e1','plan','build'],['e2','build','review']]),6]
];

export const builtInTemplates = raw.map(([id, diagramType, category, title, description, details, tags, guideId, content, recommended]) => validateTemplateContent({
  schemaVersion: TEMPLATE_VERSION, id, version: 1, source: 'builtin', diagramType, category,
  title, description, details, tags, guideId, content, sourceFormat: TYPES[diagramType].extension,
  compatibility: { adapter: diagramType, documentVersion: 1 }, recommended
}));

export const builtInTemplate = id => builtInTemplates.find(template => template.id === id);
