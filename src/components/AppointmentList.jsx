import { useState } from 'react'
import { supabase } from '../lib/supabase'
import AppointmentForm from './AppointmentForm'

export default function AppointmentList({ appointments, weekStart, onRefresh }) {
  const [adding, setAdding] = useState(false)

  const handleDelete = async (id) => {
    await supabase.from('appointments').delete().eq('id', id)
    onRefresh()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Appointments</h3>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs text-blue-600 font-medium hover:underline"
          >
            + Add
          </button>
        )}
      </div>

      {appointments.length === 0 && !adding && (
        <p className="text-sm text-gray-400 italic">No appointments</p>
      )}

      {appointments.map(appt => (
        <div key={appt.id} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <span className="text-base mt-0.5">
            {appt.type === 'cleaning' ? '🧹' : appt.type === 'exterminator' ? '🦟' : '🔨'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800">{appt.title}</p>
            <p className="text-xs text-gray-400">{appt.date}</p>
            {appt.notes && <p className="text-xs text-gray-500 mt-0.5">{appt.notes}</p>}
          </div>
          <button
            onClick={() => handleDelete(appt.id)}
            className="text-gray-300 hover:text-red-400 text-lg leading-none transition-colors"
          >
            ×
          </button>
        </div>
      ))}

      {adding && (
        <AppointmentForm
          weekStart={weekStart}
          onSaved={() => { setAdding(false); onRefresh() }}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  )
}
