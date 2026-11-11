import type { Meta, StoryObj } from '@storybook/react'
import LeaveRequestQueue from './LeaveRequestQueue'
import type { RequestDecision, TeamRequestRow } from '../../../types/models'

// Props-only contract: the queue gets its rows and decision callbacks from
// the page (which owns store wiring), so stories pin both.
const team: TeamRequestRow[] = [
  { id: 'LV-2026-00021', name: 'Sai Nithin Reddy', empId: 'EM-20810', absenceType: 'Paid Time Off', type: 'Paid Time Off', from: '2026-11-20', to: '2026-11-22', days: 3, mode: 'Full Day', reason: 'Diwali travel to Hyderabad', requestedOn: '2026-11-01', status: 'Pending' },
  { id: 'LV-2026-00024', name: 'Rahul Iyer', empId: 'EM-20832', absenceType: 'Optional Holiday', type: 'Optional Holiday', from: '2026-11-28', to: '2026-11-28', days: 1, mode: 'Full Day', reason: 'Regional holiday pick', requestedOn: '2026-11-03', status: 'Pending' },
  { id: 'LV-2026-00022', name: 'Rahul Iyer', empId: 'EM-20832', absenceType: 'Work From Home', type: 'Work From Home', from: '2026-11-25', to: '2026-11-25', days: 1, mode: 'Full Day', reason: 'Flat maintenance visitor', requestedOn: '2026-11-02', status: 'Approved' },
  { id: 'LV-2026-00023', name: 'Prastina Dash', empId: 'EM-20798', absenceType: 'Business Travel', type: 'Business Travel', from: '2026-11-18', to: '2026-11-19', days: 2, mode: 'Full Day', reason: 'Client workshop', requestedOn: '2026-11-04', status: 'Rejected' },
] as TeamRequestRow[]

const meta: Meta<typeof LeaveRequestQueue> = {
  title: 'Features/LeaveRequestQueue',
  component: LeaveRequestQueue,
  argTypes: {
    decide: { action: 'decide (single)' },
    decideMany: { action: 'decide (bulk)' },
    onError: { action: 'onError toast' },
  },
}

export default meta
type Story = StoryObj

/** Default view: the Pending filter is what managers open the page to. */
export const MixedQueue: Story = {
  args: {
    team,
    decide: async (_id: string, _decision: RequestDecision) => undefined,
    decideMany: async (_ids: string[], _decision: RequestDecision) => undefined,
    onError: () => undefined,
  },
}

export const EmptyQueue: Story = {
  args: {
    team: [],
    decide: async (_id: string, _decision: RequestDecision) => undefined,
    decideMany: async (_ids: string[], _decision: RequestDecision) => undefined,
    onError: () => undefined,
  },
}
