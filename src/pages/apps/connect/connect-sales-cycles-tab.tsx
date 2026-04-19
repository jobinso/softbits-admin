import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, ChevronRight, GitBranch } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DataTable,
  Button,
  Modal,
  StatusBadge,
  Card,
} from '@/components/shared';
import type { ColumnDef } from '@/components/shared';
import {
  getPipelines,
  createPipeline,
  updatePipeline,
  deletePipeline as deletePipelineApi,
  getStages,
  createStage,
  updateStage,
  deleteStage as deleteStageApi,
} from '@/services/admin-service';
import { useModal } from '@shared/hooks';
import type { Pipeline, Stage } from '@/types';

// ---------------------------------------------------------------------------
// Form types & defaults
// ---------------------------------------------------------------------------

interface PipelineForm {
  name: string;
  description: string;
  isDefault: boolean;
  isActive: boolean;
}

interface StageForm {
  pipelineId: string;
  name: string;
  displayOrder: number;
  probability: number;
  colour: string;
  isClosed: boolean;
  isWon: boolean;
  isActive: boolean;
}

const INITIAL_PIPELINE: PipelineForm = { name: '', description: '', isDefault: false, isActive: true };
const INITIAL_STAGE: StageForm = { pipelineId: '', name: '', displayOrder: 0, probability: 0, colour: '#3B82F6', isClosed: false, isWon: false, isActive: true };

// ---------------------------------------------------------------------------
// FormField (local helper)
// ---------------------------------------------------------------------------

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-dark-500 mb-1">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConnectSalesCyclesTab() {
  const queryClient = useQueryClient();

  // ---- Selection state ----
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);

  // ---- Modals ----
  const pipelineModal = useModal<Pipeline>();
  const deletePipelineModal = useModal<Pipeline>();
  const stageModal = useModal<Stage>();
  const deleteStageModal = useModal<Stage>();

  // ---- Form state ----
  const [pipelineForm, setPipelineForm] = useState<PipelineForm>(INITIAL_PIPELINE);
  const [isEditPipeline, setIsEditPipeline] = useState(false);
  const [stageForm, setStageForm] = useState<StageForm>(INITIAL_STAGE);
  const [isEditStage, setIsEditStage] = useState(false);

  // ---- Queries ----

  const { data: pipelinesRes } = useQuery({
    queryKey: ['connect', 'pipelines'],
    queryFn: () => getPipelines({ includeStages: true }),
  });

  const { data: stagesRes } = useQuery({
    queryKey: ['connect', 'stages', selectedPipeline?.Id],
    queryFn: () => getStages({ pipelineId: selectedPipeline?.Id }),
  });

  const pipelines: Pipeline[] = pipelinesRes?.data ?? [];
  const stages: Stage[] = stagesRes?.data ?? [];

  // ---- Mutations ----

  const savePipelineMut = useMutation({
    mutationFn: (args: { id?: string; data: Partial<Pipeline> }) =>
      args.id ? updatePipeline(args.id, args.data) : createPipeline(args.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'pipelines'] });
      pipelineModal.close();
      toast.success(isEditPipeline ? 'Pipeline updated' : 'Pipeline created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save pipeline'),
  });

  const removePipelineMut = useMutation({
    mutationFn: (id: string) => deletePipelineApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'pipelines'] });
      queryClient.invalidateQueries({ queryKey: ['connect', 'stages'] });
      deletePipelineModal.close();
      setSelectedPipeline(null);
      toast.success('Pipeline deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete pipeline'),
  });

  const saveStageMut = useMutation({
    mutationFn: (args: { id?: string; data: Partial<Stage> }) =>
      args.id ? updateStage(args.id, args.data) : createStage(args.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'stages'] });
      queryClient.invalidateQueries({ queryKey: ['connect', 'pipelines'] });
      stageModal.close();
      toast.success(isEditStage ? 'Stage updated' : 'Stage created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save stage'),
  });

  const removeStageMut = useMutation({
    mutationFn: (id: string) => deleteStageApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'stages'] });
      queryClient.invalidateQueries({ queryKey: ['connect', 'pipelines'] });
      deleteStageModal.close();
      toast.success('Stage deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete stage'),
  });

  // ---- Handlers ----

  function openCreatePipeline() {
    setPipelineForm(INITIAL_PIPELINE);
    setIsEditPipeline(false);
    pipelineModal.open();
  }
  function openEditPipeline(p: Pipeline) {
    setPipelineForm({ name: p.Name, description: p.Description || '', isDefault: p.IsDefault, isActive: p.IsActive });
    setIsEditPipeline(true);
    pipelineModal.open(p);
  }
  function handleSavePipeline() {
    if (!pipelineForm.name.trim()) { toast.error('Name is required'); return; }
    savePipelineMut.mutate({
      id: isEditPipeline ? pipelineModal.data?.Id : undefined,
      data: pipelineForm,
    });
  }

  function openCreateStage() {
    setStageForm({ ...INITIAL_STAGE, pipelineId: selectedPipeline?.Id || '' });
    setIsEditStage(false);
    stageModal.open();
  }
  function openEditStage(s: Stage) {
    setStageForm({
      pipelineId: s.PipelineId, name: s.Name, displayOrder: s.DisplayOrder || 0,
      probability: s.Probability || 0, colour: s.Colour || '#3B82F6',
      isClosed: s.IsClosed, isWon: s.IsWon, isActive: s.IsActive,
    });
    setIsEditStage(true);
    stageModal.open(s);
  }
  function handleSaveStage() {
    if (!stageForm.pipelineId) { toast.error('Pipeline is required'); return; }
    if (!stageForm.name.trim()) { toast.error('Name is required'); return; }
    saveStageMut.mutate({
      id: isEditStage ? stageModal.data?.Id : undefined,
      data: stageForm,
    });
  }

  // ---- Column definitions ----

  const stageColumns: ColumnDef<Stage>[] = [
    { key: 'DisplayOrder', label: '#', width: 50, sortable: true },
    { key: 'Name', label: 'Name', sortable: true, render: (v) => <span className="font-medium text-dark-700">{v}</span> },
    { key: 'PipelineName', label: 'Pipeline', sortable: true, render: (v) => v || '-' },
    { key: 'Probability', label: 'Probability', width: 100, sortable: true, render: (v) => v != null ? `${v}%` : '-' },
    {
      key: 'Colour', label: 'Color', width: 70, sortable: false,
      render: (v) => <span className="inline-block w-4 h-4 rounded-full border border-dark-300" style={{ backgroundColor: v || '#3B82F6' }} />,
    },
    {
      key: 'IsWon', label: 'Type', width: 80, sortable: true,
      render: (v, row) => v ? <StatusBadge status="success" label="Won" size="sm" /> : row.IsClosed ? <StatusBadge status="neutral" label="Closed" size="sm" /> : <span className="text-dark-400">-</span>,
    },
    {
      key: 'Id', label: 'Actions', width: 100, sortable: false,
      render: (_v, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openEditStage(row)} className="p-1.5 text-dark-400 hover:text-primary rounded hover:bg-dark-100" title="Edit"><Edit className="w-4 h-4" /></button>
          <button type="button" onClick={() => deleteStageModal.open(row)} className="p-1.5 text-dark-400 hover:text-danger rounded hover:bg-dark-100" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  // ---- Render ----

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pipelines List */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border border-dark-200 bg-dark-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-dark-200 flex items-center justify-between">
              <h2 className="text-sm font-medium text-dark-600">Pipelines ({pipelines.length})</h2>
              <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreatePipeline}>Add</Button>
            </div>
            <div className="divide-y divide-dark-200 max-h-[500px] overflow-y-auto">
              {pipelines.length === 0 ? (
                <div className="p-6 text-center text-dark-400 text-sm">No pipelines</div>
              ) : pipelines.map((p) => (
                <button
                  key={p.Id}
                  type="button"
                  onClick={() => setSelectedPipeline(p)}
                  className={`w-full px-4 py-3 text-left flex items-center justify-between transition-colors ${
                    selectedPipeline?.Id === p.Id ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-dark-100'
                  }`}
                >
                  <div>
                    <div className={`text-sm font-medium ${selectedPipeline?.Id === p.Id ? 'text-primary' : 'text-dark-600'}`}>
                      {p.Name}
                    </div>
                    <div className="text-xs text-dark-400">{p.stages?.length ?? 0} stages {p.IsDefault && '(Default)'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={(e) => { e.stopPropagation(); openEditPipeline(p); }} className="p-1 text-dark-400 hover:text-primary"><Edit className="w-3.5 h-3.5" /></button>
                    {!p.IsDefault && <button type="button" onClick={(e) => { e.stopPropagation(); deletePipelineModal.open(p); }} className="p-1 text-dark-400 hover:text-danger"><Trash2 className="w-3.5 h-3.5" /></button>}
                    <ChevronRight className="w-4 h-4 text-dark-400" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stages */}
        <div className="lg:col-span-2">
          {!selectedPipeline ? (
            <div className="rounded-lg border border-dark-200 bg-dark-50 p-12 text-center">
              <GitBranch className="w-12 h-12 text-dark-300 mx-auto mb-3" />
              <p className="text-dark-400">Select a pipeline to view its stages.</p>
            </div>
          ) : (
            <Card
              title={`Stages in "${selectedPipeline.Name}"`}
              headerAction={<Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreateStage}>Add Stage</Button>}
            >
              <DataTable<Stage>
                id="connect-stages"
                columns={stageColumns}
                data={stages}
                rowKey={(row) => row.Id}
                onRowClick={openEditStage}
                emptyMessage="No stages. Click Add Stage to create one."
              />
            </Card>
          )}
        </div>
      </div>

      {/* Pipeline Modal */}
      <Modal isOpen={pipelineModal.isOpen} onClose={pipelineModal.close} title={isEditPipeline ? 'Edit Pipeline' : 'Add Pipeline'} size="sm" footer={
        <><Button variant="secondary" onClick={pipelineModal.close}>Cancel</Button>
        <Button onClick={handleSavePipeline} loading={savePipelineMut.isPending}>{isEditPipeline ? 'Save Changes' : 'Create'}</Button></>
      }>
        <div className="space-y-4">
          <FormField label="Name" required><input type="text" value={pipelineForm.name} onChange={(e) => setPipelineForm({ ...pipelineForm, name: e.target.value })} className="form-input" /></FormField>
          <FormField label="Description"><textarea value={pipelineForm.description} onChange={(e) => setPipelineForm({ ...pipelineForm, description: e.target.value })} className="form-input" rows={2} /></FormField>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-dark-600 cursor-pointer"><input type="checkbox" checked={pipelineForm.isDefault} onChange={(e) => setPipelineForm({ ...pipelineForm, isDefault: e.target.checked })} className="w-4 h-4 rounded border-dark-300" />Default</label>
            <label className="flex items-center gap-2 text-sm text-dark-600 cursor-pointer"><input type="checkbox" checked={pipelineForm.isActive} onChange={(e) => setPipelineForm({ ...pipelineForm, isActive: e.target.checked })} className="w-4 h-4 rounded border-dark-300" />Active</label>
          </div>
        </div>
      </Modal>

      {/* Delete Pipeline Modal */}
      <Modal isOpen={deletePipelineModal.isOpen} onClose={deletePipelineModal.close} title="Delete Pipeline" size="sm" footer={
        <><Button variant="secondary" onClick={deletePipelineModal.close}>Cancel</Button>
        <Button variant="danger" onClick={() => deletePipelineModal.data && removePipelineMut.mutate(deletePipelineModal.data.Id)} loading={removePipelineMut.isPending}>Delete</Button></>
      }>
        <p className="text-sm text-dark-500">Delete <strong className="text-dark-700">{deletePipelineModal.data?.Name}</strong> and all its stages?</p>
      </Modal>

      {/* Stage Modal */}
      <Modal isOpen={stageModal.isOpen} onClose={stageModal.close} title={isEditStage ? 'Edit Stage' : 'Add Stage'} size="sm" footer={
        <><Button variant="secondary" onClick={stageModal.close}>Cancel</Button>
        <Button onClick={handleSaveStage} loading={saveStageMut.isPending}>{isEditStage ? 'Save Changes' : 'Create'}</Button></>
      }>
        <div className="space-y-4">
          <FormField label="Pipeline" required>
            <select value={stageForm.pipelineId} onChange={(e) => setStageForm({ ...stageForm, pipelineId: e.target.value })} className="form-input" disabled={isEditStage}>
              <option value="">Select Pipeline</option>
              {pipelines.map((p) => <option key={p.Id} value={p.Id}>{p.Name}</option>)}
            </select>
          </FormField>
          <FormField label="Name" required><input type="text" value={stageForm.name} onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })} className="form-input" /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Order"><input type="number" value={stageForm.displayOrder} onChange={(e) => setStageForm({ ...stageForm, displayOrder: parseInt(e.target.value) || 0 })} className="form-input" /></FormField>
            <FormField label="Probability %"><input type="number" value={stageForm.probability} onChange={(e) => setStageForm({ ...stageForm, probability: parseFloat(e.target.value) || 0 })} className="form-input" min={0} max={100} /></FormField>
          </div>
          <FormField label="Color">
            <div className="flex items-center gap-2">
              <input type="color" value={stageForm.colour} onChange={(e) => setStageForm({ ...stageForm, colour: e.target.value })} className="w-8 h-8 rounded border border-dark-300 cursor-pointer" />
              <input type="text" value={stageForm.colour} onChange={(e) => setStageForm({ ...stageForm, colour: e.target.value })} className="form-input flex-1" />
            </div>
          </FormField>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-dark-600 cursor-pointer"><input type="checkbox" checked={stageForm.isClosed} onChange={(e) => setStageForm({ ...stageForm, isClosed: e.target.checked })} className="w-4 h-4 rounded border-dark-300" />Closed</label>
            <label className="flex items-center gap-2 text-sm text-dark-600 cursor-pointer"><input type="checkbox" checked={stageForm.isWon} onChange={(e) => setStageForm({ ...stageForm, isWon: e.target.checked })} className="w-4 h-4 rounded border-dark-300" />Won</label>
            <label className="flex items-center gap-2 text-sm text-dark-600 cursor-pointer"><input type="checkbox" checked={stageForm.isActive} onChange={(e) => setStageForm({ ...stageForm, isActive: e.target.checked })} className="w-4 h-4 rounded border-dark-300" />Active</label>
          </div>
        </div>
      </Modal>

      {/* Delete Stage Modal */}
      <Modal isOpen={deleteStageModal.isOpen} onClose={deleteStageModal.close} title="Delete Stage" size="sm" footer={
        <><Button variant="secondary" onClick={deleteStageModal.close}>Cancel</Button>
        <Button variant="danger" onClick={() => deleteStageModal.data && removeStageMut.mutate(deleteStageModal.data.Id)} loading={removeStageMut.isPending}>Delete</Button></>
      }>
        <p className="text-sm text-dark-500">Delete stage <strong className="text-dark-700">{deleteStageModal.data?.Name}</strong>?</p>
      </Modal>
    </div>
  );
}
