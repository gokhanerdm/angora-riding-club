import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-lg max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Erişim Reddedildi</h1>
        <p className="text-gray-400 mb-6">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
        <Link href="/login" className="inline-block px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700">
          Giriş Sayfasına Dön
        </Link>
      </div>
    </div>
  )
}