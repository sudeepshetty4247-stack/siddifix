// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildDemoDataset } from '@/lib/demo-seed';
import { wardPreviewPoint } from '@/lib/bengaluru-map';
import { pointInGeometry } from '@/lib/directory';

describe('Area-isolated demonstration coordinates', () => {
  const polygon = { type: 'Polygon', coordinates: [[[77,14],[78,14],[78,15],[77,15],[77,14]]] };
  it('selects an interior point for a GeoJSON Polygon', () => {
    const point = wardPreviewPoint({boundary:polygon});
    expect(point).not.toBeNull();
    expect(point && pointInGeometry(point.lat,point.lng,polygon)).toBe(true);
  });
  it('keeps all 100 Anantapur synthetic reports linked only to their selected area', () => {
    const dataset = buildDemoDataset({datasetId:'anantapur-demo-v1',count:100,wards:[{identifier:'fixture-only',name:'Fixture',corporation:null,coverage_id:'anantapur',lat:14.5,lng:77.5}],teams:[],staff:[],targets:[],categories:[{id:'roads',subs:['Pothole']}]});
    expect(dataset.issues).toHaveLength(100);
    expect(dataset.issues.every(i => (i.routing_snapshot['coverage'] as {id:string}).id==='anantapur')).toBe(true);
    expect(dataset.issues.every(i => i.demo_dataset_id==='anantapur-demo-v1')).toBe(true);
    expect(dataset.issues.every(i => pointInGeometry(i.lat,i.lng,polygon))).toBe(true);
  });
});