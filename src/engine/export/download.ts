/** Triggers a browser download for an exported blob. */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/** Sanitizes a project name for use in export filenames. */
export function exportFileBaseName(projectName: string): string {
    return projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'raylight';
}
