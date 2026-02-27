import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../utils/logger';
import { AlertTriangle, RefreshCw, Home, RotateCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo?: ErrorInfo | null;
}

/**
 * Global Error Boundary (Mukammallashtirilgan)
 * 1. Render xatolarini ushlaydi.
 * 2. Global window.error va Promise rejectionlarni ushlaydi.
 * 3. Foydalanuvchiga tushunarli interfeys beradi.
 */
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  // React Lifecycle: Render paytidagi xatoni ushlash va state yangilash
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  // React Lifecycle: Xatoni log qilish
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    try {
        logger.error('React Render Error', error, { componentStack: errorInfo.componentStack });
    } catch(e) {
        console.error("Logger failed:", e);
    }
  }

  // Global xatolarni (Asinxron/Eventlar) ushlash uchun
  public componentDidMount() {
    window.addEventListener('error', this.handleGlobalError);
    window.addEventListener('unhandledrejection', this.handlePromiseRejection);
  }

  public componentWillUnmount() {
    window.removeEventListener('error', this.handleGlobalError);
    window.removeEventListener('unhandledrejection', this.handlePromiseRejection);
  }

  private handleGlobalError = (event: ErrorEvent) => {
    // Reactning o'z overlayi Development rejimida baribir chiqadi, lekin bu method
    // Productionda va React qamrab olmagan joylarda ishlaydi.
    logger.error('Global Runtime Error', event.error);
    this.setState({ 
      hasError: true, 
      error: event.error instanceof Error ? event.error : new Error(event.message || 'Unknown Global Error')
    });
  };

  private handlePromiseRejection = (event: PromiseRejectionEvent) => {
    logger.error('Unhandled Promise Rejection', event.reason);
    const errorObj = event.reason instanceof Error 
      ? event.reason 
      : new Error(typeof event.reason === 'string' ? event.reason : 'Unhandled Promise Rejection');
      
    this.setState({ 
      hasError: true, 
      error: errorObj
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Xato xabarini xavfsiz olish
      let errorMessage = "Noma'lum xatolik yuz berdi.";
      try {
        if (this.state.error instanceof Error) {
            errorMessage = this.state.error.message;
        } else if (typeof this.state.error === 'string') {
            errorMessage = this.state.error;
        } else {
            errorMessage = JSON.stringify(this.state.error);
        }
      } catch (e) {
        errorMessage = "Error details could not be displayed.";
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 z-[9999] relative">
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10 max-w-lg w-full text-center border border-slate-100 animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-rose-100">
              <AlertTriangle className="w-10 h-10" />
            </div>
            
            <h1 className="text-2xl font-black text-slate-800 mb-3">
              Dasturda xatolik yuz berdi
            </h1>
            
            <p className="text-slate-500 mb-6 font-medium text-sm leading-relaxed">
              Uzr, kutilmagan muammo yuzaga keldi. Xavotir olmang, biz bu haqda xabardormiz.
              Quyidagi tugmalar orqali davom etishingiz mumkin.
            </p>

            <div className="bg-rose-50 p-4 rounded-xl text-left mb-8 overflow-auto max-h-40 border border-rose-100 custom-scrollbar">
                <p className="text-xs font-mono text-rose-600 break-words font-bold">
                    {errorMessage}
                </p>
                {this.state.errorInfo && (
                   <details className="mt-2 text-[10px] text-rose-400 font-mono">
                      <summary className="cursor-pointer hover:text-rose-600 transition-colors">Texnik tafsilotlar (Stack Trace)</summary>
                      <pre className="whitespace-pre-wrap mt-1 pl-2 border-l-2 border-rose-200">
                        {this.state.errorInfo.componentStack}
                      </pre>
                   </details>
                )}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleRetry}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                Qayta urinish (Soft Retry)
              </button>

              <div className="flex gap-3">
                <button
                  onClick={this.handleReload}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" />
                  Yangilash
                </button>
                
                <button
                  onClick={this.handleGoHome}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all active:scale-95"
                >
                  <Home className="w-4 h-4" />
                  Bosh sahifa
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;