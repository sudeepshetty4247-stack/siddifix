import { render,screen,fireEvent,waitFor,cleanup } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { afterEach,describe,it,expect,vi } from 'vitest';
import { AddressEntry } from '@/components/civic/AddressEntry';
const mocks=vi.hoisted(()=>({search:vi.fn(),validate:vi.fn()}));
vi.mock('@tanstack/react-start',()=>({useServerFn:(f:unknown)=>f}));
vi.mock('@/lib/geocoding.functions',()=>({searchAddress:mocks.search}));
vi.mock('@/lib/incident-location.functions',()=>({validateIncidentLocation:mocks.validate}));
afterEach(()=>{cleanup();sessionStorage.clear();vi.clearAllMocks();});
const row={lat:12.89,lng:77.63,label:'Kudlu Gate, Bengaluru, India'};
function mount(){const select=vi.fn();render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><AddressEntry onSelect={select}/></QueryClientProvider>);return select;}
describe('Incident address interaction with isolated provider fixtures',()=>{
 it('fetches automatically and commits keyboard selection only after coverage check',async()=>{
  mocks.search.mockResolvedValue({results:[row],notice:null});mocks.validate.mockResolvedValue({status:'supported',checkedAt:'2026-10-24'});const select=mount();
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'Kudlu Gate'}});
  await screen.findByRole('option');fireEvent.keyDown(screen.getByRole('combobox'),{key:'ArrowDown'});fireEvent.keyDown(screen.getByRole('combobox'),{key:'Enter'});
  await waitFor(()=>expect(select).toHaveBeenCalledWith(expect.objectContaining({originalAddress:'Kudlu Gate',lat:12.89,verification:'supported'})));
 });
 it('ignores a slow earlier response when a newer query is typed',async()=>{
  let resolveOld:(v:unknown)=>void=()=>{};mocks.search.mockImplementation(({data}:{data:{query:string}})=>data.query==='Old'?new Promise(resolve=>{resolveOld=resolve;}):Promise.resolve({results:[row],notice:null}));mount();
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'Old'}});await waitFor(()=>expect(mocks.search).toHaveBeenCalled());
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'Kudlu Gate'}});await screen.findByRole('option');resolveOld({results:[{...row,label:'Old address'}],notice:null});
  await waitFor(()=>expect(screen.queryByText('Old address')).toBeNull());expect(screen.getByRole('option').textContent).toContain('Kudlu Gate');
 });
 it('keeps exact manual text and never selects unrelated coordinates on provider failure',async()=>{
  mocks.search.mockRejectedValue(new Error('offline'));const select=mount();fireEvent.click(screen.getByRole('button',{name:'Enter address manually'}));
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'  24 Main Road, Mysuru  '}});fireEvent.click(screen.getByRole('button',{name:'Verify manual address'}));
  await screen.findByRole('alert');expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('  24 Main Road, Mysuru  ');expect(select).not.toHaveBeenCalled();expect(mocks.validate).not.toHaveBeenCalled();
 });
 it('allows touch/click selection outside coverage and preserves editable address',async()=>{
  mocks.search.mockResolvedValue({results:[{...row,label:'Hyderabad, Telangana, India'}],notice:null});mocks.validate.mockResolvedValue({status:'outside',checkedAt:'2026-10-24'});mount();
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'Hyderabad'}});fireEvent.click(await screen.findByRole('option'));await screen.findByRole('button',{name:'Change address'});fireEvent.click(screen.getByRole('button',{name:'Change address'}));
  expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('Hyderabad');await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('combobox')));
 });
 it('shows no-results state without marking unknown location as outside',async()=>{
  mocks.search.mockResolvedValue({results:[],notice:'No places found. Try a more complete address.'});const select=mount();fireEvent.change(screen.getByRole('combobox'),{target:{value:'Unknown locality'}});await screen.findByText('No places found. Try a more complete address.');expect(select).not.toHaveBeenCalled();
 });
});