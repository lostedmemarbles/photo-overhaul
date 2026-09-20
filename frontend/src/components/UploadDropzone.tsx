import { useRef, useState, type DragEvent } from 'react'

interface Props {
  onFilesSelected: (files: File[]) => void
  disabled?: boolean
}

const ACCEPTED_EXTENSIONS = ['.heic', '.heif', '.jpg', '.jpeg', '.png']

export function UploadDropzone({ onFilesSelected, disabled }: Props) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled) return
    onFilesSelected(Array.from(e.dataTransfer.files))
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      style={{
        border: `2px dashed ${isDragOver ? '#4287f5' : '#999'}`,
        borderRadius: 8,
        padding: '3rem 1rem',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <p>Drag and drop photos here, or click to choose files</p>
      <p style={{ fontSize: '0.85rem', color: '#666' }}>
        Supports HEIC, JPG, and PNG
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS.join(',')}
        style={{ display: 'none' }}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files) onFilesSelected(Array.from(e.target.files))
          e.target.value = ''
        }}
      />
    </div>
  )
}
