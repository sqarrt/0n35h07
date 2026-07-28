import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VersionChip } from '../../src/components/VersionChip'

describe('VersionChip', () => {
  it('shows the version from __APP_VERSION__ with a v prefix', () => {
    render(<VersionChip />)
    expect(screen.getByText(`v${__APP_VERSION__}`)).toBeTruthy()
  })
})
