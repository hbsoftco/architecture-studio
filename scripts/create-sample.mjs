import { mkdir, writeFile } from 'node:fs/promises';
import { createProject, createDocument, uid } from '../src/model.js';
import { projectZip } from '../src/export.js';

const project = createProject('نمونهٔ معماری سامانهٔ سفارش');
const flow = createDocument('mermaid', 'جریان سفارش');
flow.content = 'flowchart LR\n  U[کاربر] --> O[ثبت سفارش]\n  O --> P{پرداخت موفق؟}\n  P -->|بله| S[ارسال]\n  P -->|خیر| R[تلاش دوباره]';
const process = createDocument('bpmn', 'فرایند سفارش');
process.content = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_sample" targetNamespace="http://architecture.studio/sample">
<bpmn:process id="Process_order" isExecutable="false"><bpmn:startEvent id="Start_order" name="سفارش"/><bpmn:task id="Task_review" name="بررسی سفارش"/><bpmn:endEvent id="End_order" name="پایان"/><bpmn:sequenceFlow id="Flow_1" sourceRef="Start_order" targetRef="Task_review"/><bpmn:sequenceFlow id="Flow_2" sourceRef="Task_review" targetRef="End_order"/></bpmn:process>
<bpmndi:BPMNDiagram id="Diagram_order"><bpmndi:BPMNPlane id="Plane_order" bpmnElement="Process_order"><bpmndi:BPMNShape id="Start_di" bpmnElement="Start_order"><dc:Bounds x="120" y="120" width="36" height="36"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="Task_di" bpmnElement="Task_review"><dc:Bounds x="220" y="100" width="120" height="80"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="End_di" bpmnElement="End_order"><dc:Bounds x="410" y="120" width="36" height="36"/></bpmndi:BPMNShape><bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="156" y="138"/><di:waypoint x="220" y="138"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="340" y="138"/><di:waypoint x="410" y="138"/></bpmndi:BPMNEdge></bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn:definitions>`;
const decision = createDocument('dmn', 'تصمیم ارسال');
decision.content = `<?xml version="1.0" encoding="UTF-8"?><definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/" xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/" id="Definitions_shipping" name="Shipping" namespace="http://architecture.studio/sample"><decision id="Decision_ship" name="روش ارسال"><decisionTable id="DecisionTable_ship" hitPolicy="UNIQUE"><input id="Input_urgent" label="فوری"><inputExpression id="Expr_urgent" typeRef="boolean"><text>urgent</text></inputExpression></input><output id="Output_method" label="روش" name="method" typeRef="string"/><rule id="Rule_1"><inputEntry id="InputEntry_1"><text>true</text></inputEntry><outputEntry id="OutputEntry_1"><text>"پیک"</text></outputEntry></rule><rule id="Rule_2"><inputEntry id="InputEntry_2"><text>false</text></inputEntry><outputEntry id="OutputEntry_2"><text>"پست"</text></outputEntry></rule></decisionTable></decision><dmndi:DMNDI><dmndi:DMNDiagram id="Diagram_shipping"><dmndi:DMNShape id="Shape_shipping" dmnElementRef="Decision_ship"><dc:Bounds x="100" y="100" width="180" height="80"/></dmndi:DMNShape></dmndi:DMNDiagram></dmndi:DMNDI></definitions>`;
const architecture = createDocument('c4', 'ساختار سامانه');
const client = uid(), service = uid(), database = uid();
architecture.content = JSON.stringify({ schemaVersion: 1, nodes: [
  { id: client, kind: 'box', label: 'کاربر', x: 80, y: 100, w: 180, h: 96, fill: '#e7f1ee' },
  { id: service, kind: 'service', label: 'سرویس سفارش', x: 420, y: 100, w: 180, h: 96, fill: '#dceae7' },
  { id: database, kind: 'database', label: 'پایگاه داده', x: 760, y: 100, w: 180, h: 96, fill: '#e4e8f2' }
], edges: [{ id: uid(), from: client, to: service, label: 'HTTP' }, { id: uid(), from: service, to: database, label: 'SQL' }] });
project.documents.push(flow, process, decision, architecture);
project.links.push({ id: uid(), fromDocId: process.id, fromElementId: 'Task_review', toDocId: architecture.id, toElementId: service });
project.links.push({ id: uid(), fromDocId: architecture.id, fromElementId: service, toDocId: decision.id, toElementId: 'Decision_ship' });
await mkdir(new URL('../samples/', import.meta.url), { recursive: true });
await writeFile(new URL('../samples/starter-project.zip', import.meta.url), Buffer.from(await (await projectZip(project)).arrayBuffer()));
console.log('Created samples/starter-project.zip');
