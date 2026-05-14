import { jsPDF } from 'jspdf';

export const exportChatToPdf = (messages, documentName) => {
  try {
    if (!messages || messages.length === 0) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    let y = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(233, 30, 140);
    doc.text('NEXORA', 20, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Document: ${documentName || 'Multiple Documents'}`, 20, y);
    y += 6;
    doc.text(`Exported on: ${new Date().toLocaleString()}`, 20, y);
    y += 8;

    doc.setDrawColor(233, 30, 140);
    doc.line(20, y, 190, y);
    y += 8;

    // Messages
    messages.forEach((msg) => {
      if (y > 265) {
        doc.addPage();
        y = 20;
      }

      if (msg.role === 'user') {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(233, 30, 140);
        doc.text('YOU', 20, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 30, 30);
        const lines = doc.splitTextToSize(msg.content || '', 165);
        doc.text(lines, 20, y);
        y += lines.length * 5 + 6;
      }

      if (msg.role === 'assistant') {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text('NEXORA', 20, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 30, 30);
        
        const cleanText = (msg.content || '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/#(.*?)\n/g, '$1\n');
        const lines = doc.splitTextToSize(cleanText, 165);
        doc.text(lines, 20, y);
        y += lines.length * 5 + 4;

        if (msg.metadata && msg.metadata.source_pages && msg.metadata.source_pages.length > 0) {
          doc.setFontSize(9);
          doc.setTextColor(233, 30, 140);
          doc.text(`Sources: Page ${msg.metadata.source_pages.join(', Page ')}`, 20, y);
          doc.setTextColor(30, 30, 30);
          y += 6;
        }
        y += 4;
      }
    });

    // Download using blob method (most reliable)
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nexora-chat-export.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

  } catch (err) {
    console.error('Export PDF error:', err);
    throw err;
  }
};
