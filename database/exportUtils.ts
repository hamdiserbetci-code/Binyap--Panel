import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Veriyi Excel formatında dışa aktarır.
 */
export const exportToExcel = (data: any[], filename: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sayfa1');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

/**
 * Excel dosyasını JSON formatında içeri aktarır.
 */
export const importFromExcel = (file: File, callback: (data: any[]) => void) => {
  const reader = new FileReader();
  reader.onload = (evt) => {
    const bstr = evt?.target?.result;
    if (bstr) {
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      callback(data);
    }
  };
  reader.readAsBinaryString(file);
};

/**
 * Veriyi PDF formatında dışa aktarır.
 */
export const exportToPDF = (columns: string[], data: any[], filename: string, title: string) => {
  const doc = new jsPDF();
  
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  
  // Tablo başlıkları ve içerikleri haritalanıyor
  const tableData = data.map(row => columns.map(col => row[col] || ''));
  
  autoTable(doc, {
    head: [columns],
    body: tableData,
    startY: 20,
  });
  
  doc.save(`${filename}.pdf`);
};