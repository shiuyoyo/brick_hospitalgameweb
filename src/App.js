import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import GeneralRegisterPage from './GeneralRegisterPage';
import DoctorRegisterPage from './DoctorRegisterPage';
import DoctorDashboard from './DoctorDashboard';

// Supabase Configuration - 您的真實憑證
const SUPABASE_URL = 'https://bxpooqjjozrtxbgbkymf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4cG9vcWpqb3pydHhiZ2JreW1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNDQ2NDEsImV4cCI6MjA2ODkyMDY0MX0.yUlA7kSOx_02T9LUK3p3znl4BEiEAeqDUbJMuKvbFQ8';

// 真實 Supabase 客戶端
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('SUPABASE_URL =', process.env.NEXT_PUBLIC_SUPABASE_URL);
const JimuApp = () => {
  const [currentSection, setCurrentSection] = useState('login');
  const [userType, setUserType] = useState('doctor'); // 'doctor' or 'general'
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Form states
  const [loginData, setLoginData] = useState({
    username: '',
    password: ''
  });

  const [emailVerification, setEmailVerification] = useState({
    email: '',
    isVerified: false
  });

  // Countdown timer for resend verification
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Initialize Supabase auth listener (主要用於醫生用戶)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && session.user) {
        console.log('Auth state changed - 用戶登入:', session.user);
        setUser(session.user);
        setCurrentSection('dashboard');
      } else if (event === 'SIGNED_OUT') {
        console.log('Auth state changed - 用戶登出');
        setUser(null);
        setCurrentSection('login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Login function - 混合模式：一般用戶用新邏輯，醫生用舊邏輯
  const handleLogin = async () => {
    if (!loginData.username || !loginData.password) {
      setMessage('請輸入正確的帳號及密碼');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const usernameOrEmail = loginData.username.trim();
      const password = loginData.password;
      
      console.log('🔍 嘗試登入:', usernameOrEmail);
      
      // 檢查輸入是否為 Email（包含 @）
      const isEmail = usernameOrEmail.includes("@");
      
      // 先查詢 user_profiles 確定用戶類型
      let query = supabase.from('user_profiles').select('*');
      
      if (isEmail) {
        query = query.eq('email', usernameOrEmail);
      } else {
        query = query.eq('username', usernameOrEmail);
      }
      
      const { data: userProfiles, error: profileError } = await query;
      
      console.log('📊 查詢結果:', { userProfiles, profileError });
      
      if (profileError) {
        console.error('❌ 查詢用戶資料錯誤:', profileError);
        setMessage('系統錯誤，請稍後再試');
      } else if (!userProfiles || userProfiles.length === 0) {
        console.log('❌ 找不到用戶:', usernameOrEmail);
        setMessage('找不到此帳號，請檢查帳號是否正確');
      } else {
        const userProfile = userProfiles[0];
        console.log('✅ 找到用戶資料:', userProfile);
        
        // 根據用戶類型使用不同的登入方式
        if (userProfile.user_type === 'general') {
          // === 一般用戶：新的密碼驗證邏輯 ===
          console.log('👤 一般用戶登入流程');
          
          // 檢查驗證狀態
          if (userProfile.verification_status !== 'verified') {
            console.log('⚠️ 一般用戶未驗證:', userProfile.verification_status);
            setMessage('您的帳號尚未通過驗證，請聯繫管理員');
            setLoading(false);
            return;
          }
          
          const expectedPassword = userProfile.username.slice(-6); // 身分證後六碼
          console.log('🔑 一般用戶密碼驗證:');
          console.log('   - 輸入密碼:', password);
          console.log('   - 期望密碼:', expectedPassword);
          
          if (password === expectedPassword) {
            console.log('✅ 一般用戶登入成功');
            setMessage('登入成功！');
            
            // 創建模擬的 user 物件
            const mockUser = {
              id: userProfile.id,
              email: userProfile.email,
              user_metadata: {
                username: userProfile.username,
                user_type: userProfile.user_type,
                full_name: userProfile.full_name
              }
            };
            
            setUser(mockUser);
            setCurrentSection('dashboard');
            setLoginData({ username: '', password: '' });
          } else {
            console.log('❌ 一般用戶密碼錯誤');
            setMessage(`密碼錯誤，請輸入身分證後六碼（期望：${expectedPassword}）`);
          }
        } else {
          // === 醫生用戶：使用舊的登入邏輯 ===
          console.log('🩺 醫生用戶登入流程（使用舊邏輯）');
          
          if (isEmail) {
            // 直接用 Email 登入
            console.log('使用 Email 登入');
            const response = await supabase.auth.signInWithPassword({ 
              email: usernameOrEmail, 
              password: password 
            });

            if (response.error) {
              console.error('Email 登入錯誤:', response.error);
              setMessage('帳號或密碼錯誤，請檢查後重試');
            } else if (response.data.user) {
              console.log('Email 登入成功:', response.data.user);
              setMessage('登入成功！');
              setUser(response.data.user);
              setCurrentSection('dashboard');
              setLoginData({ username: '', password: '' });
            }
          } else {
            // 使用使用者名稱登入：先查詢對應的 Email
            console.log('使用使用者名稱登入，查詢對應 Email');
            
            // 我們已經有 userProfile，直接使用其 email
            const userEmail = userProfile.email;
            console.log('找到對應 Email:', userEmail);
            
            const response = await supabase.auth.signInWithPassword({ 
              email: userEmail, 
              password: password 
            });

            if (response.error) {
              console.error('使用者名稱登入錯誤:', response.error);
              setMessage('帳號或密碼錯誤，請檢查後重試');
            } else if (response.data.user) {
              console.log('使用者名稱登入成功:', response.data.user);
              setMessage('登入成功！');
              setUser(response.data.user);
              setCurrentSection('dashboard');
              setLoginData({ username: '', password: '' });
            } else {
              setMessage('登入失敗，請聯繫系統管理員');
            }
          }
        }
      }
    } catch (err) {
      console.error('❌ 登入異常:', err);
      setMessage('登入異常，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // Send verification email
  const handleSendVerification = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setCurrentSection('emailSent');
    setCountdown(60);
    setLoading(false);
  };

  // Resend verification
  const handleResendVerification = () => {
    setCountdown(60);
    console.log('Resending verification to:', emailVerification.email);
  };

  // Logout function
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCurrentSection('login');
    setMessage('');
    setLoginData({ username: '', password: '' });
  };

  // CSS 樣式
  const styles = {
    // 背景漸層
    background: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      background: 'linear-gradient(135deg, #FEF3C7 0%, #DBEAFE 100%)'
    },
    // 主要卡片
    card: {
      width: '100%',
      maxWidth: '1000px',
      backgroundColor: 'white',
      borderRadius: '24px',
      padding: '0',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      overflow: 'hidden',
      display: 'flex',
      minHeight: '500px'
    },
    // 錯誤訊息
    errorMessage: {
      marginBottom: '16px',
      padding: '12px',
      backgroundColor: '#FEF2F2',
      border: '1px solid #FECACA',
      borderRadius: '8px',
      color: '#B91C1C',
      fontSize: '14px',
      textAlign: 'center'
    },
    // 使用者類型切換按鈕
    tabContainer: {
      display: 'flex',
      marginBottom: '32px'
    },
    tabButton: (active) => ({
      flex: 1,
      padding: '12px 16px',
      fontWeight: '500',
      border: 'none',
      cursor: 'pointer',
      backgroundColor: active ? '#4F46E5' : '#F3F4F6',
      color: active ? 'white' : '#6B7280',
      borderRadius: active === 'doctor' ? '8px 0 0 8px' : '0 8px 8px 0',
      transition: 'all 0.2s'
    }),
    // Logo 區域
    logoContainer: {
      textAlign: 'center',
      marginBottom: '32px'
    },
    logoImage: {
      width: '120px',
      height: '120px',
      margin: '0 auto 24px'
    },
    logoTitle: {
      color: '#4F46E5',
      fontSize: '24px',
      fontWeight: '500'
    },
    // 表單區域
    formContainer: {
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    },
    // 輸入框標籤
    label: {
      display: 'block',
      color: '#374151',
      fontWeight: '500',
      marginBottom: '8px'
    },
    // 輸入框
    input: {
      width: '100%',
      padding: '12px 16px',
      backgroundColor: '#F9FAFB',
      border: 'none',
      borderRadius: '8px',
      fontSize: '16px',
      outline: 'none',
      transition: 'all 0.2s',
      boxSizing: 'border-box'
    },
    // 密碼輸入框容器
    passwordContainer: {
      position: 'relative'
    },
    passwordToggle: {
      position: 'absolute',
      right: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      background: 'none',
      border: 'none',
      cursor: 'pointer'
    },
    // 連結按鈕
    linkContainer: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '14px'
    },
    link: {
      color: '#4F46E5',
      textDecoration: 'none',
      cursor: 'pointer',
      background: 'none',
      border: 'none'
    },
    // 主要按鈕
    primaryButton: (disabled) => ({
      width: '100%',
      backgroundColor: disabled ? '#9CA3AF' : '#4F46E5',
      color: 'white',
      padding: '16px',
      borderRadius: '16px',
      fontWeight: '500',
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background-color 0.2s'
    }),
    // 次要按鈕
    secondaryButton: (disabled) => ({
      width: '100%',
      backgroundColor: disabled ? '#DBEAFE' : '#DBEAFE',
      color: disabled ? '#6366F1' : '#3730A3',
      padding: '16px',
      borderRadius: '16px',
      fontWeight: '500',
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background-color 0.2s'
    }),
    // 測試帳號提示
    testHint: {
      marginTop: '24px',
      textAlign: 'center',
      fontSize: '14px',
      color: '#6B7280'
    },
    // 返回按鈕
    backButton: {
      marginBottom: '24px',
      background: 'none',
      border: 'none',
      cursor: 'pointer'
    },
    // 信箱圖示
    emailIcon: {
      width: '64px',
      height: '64px',
      margin: '0 auto 24px'
    },
    // 文字置中
    textCenter: {
      textAlign: 'center'
    },
    // 清除浮動
    clearfix: {
      clear: 'both'
    },
    // 浮動左側
    floatLeft: {
      float: 'left'
    },
    // 導航列
    navbar: {
      backgroundColor: 'white',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      padding: '16px'
    },
    navContainer: {
      maxWidth: '1152px',
      margin: '0 auto',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    navLogo: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    navLogoIcon: {
      width: '32px',
      height: '32px',
      backgroundColor: '#4F46E5',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    navLogoText: {
      fontWeight: '600',
      color: '#1F2937'
    },
    logoutButton: {
      color: '#DC2626',
      background: 'none',
      border: 'none',
      cursor: 'pointer'
    },
    // 儀表板
    dashboard: {
      minHeight: '100vh',
      backgroundColor: '#F9FAFB'
    },
    dashboardContainer: {
      maxWidth: '1152px',
      margin: '0 auto',
      padding: '24px'
    },
    dashboardCard: {
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      padding: '24px'
    }
  };

  // 渲染不同頁面
  const renderSection = () => {
    switch (currentSection) {
      case 'login':
        return (
          <div style={styles.background}>
            <div style={styles.card}>
              {/* 左側 Logo 區域 */}
              <div style={{
                flex: 1,
                backgroundColor: 'white',
                padding: '40px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {/* Logo 和標題 */}
                <div style={styles.logoContainer}>
                  <div style={styles.logoImage}>
                    <img src="ic_login_logo.png" alt="積木 Logo" style={{width: '100%', height: '100%'}} />
                  </div>
                  <h1 style={styles.logoTitle}>Welcome To Rehab</h1>
                </div>
              </div>

              {/* 右側登入表單區域 */}
              <div style={{
                flex: 1,
                backgroundColor: 'white',
                padding: '40px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                {message && (
                  <div style={styles.errorMessage}>
                    {message}
                  </div>
                )}
                
                {/* 使用者類型切換 */}
                <div style={{...styles.tabContainer, marginBottom: '32px'}}>
                  <button
                    onClick={() => setUserType('doctor')}
                    style={styles.tabButton(userType === 'doctor' ? 'doctor' : false)}
                  >
                    醫生
                  </button>
                  <button
                    onClick={() => setUserType('general')}
                    style={styles.tabButton(userType === 'general' ? 'general' : false)}
                  >
                    一般用戶
                  </button>
                </div>

                {/* 登入表單 */}
                <div style={styles.formContainer}>
                  <div>
                    <label style={styles.label}>使用者名稱或 Email</label>
                    <input
                      type="text"
                      value={loginData.username}
                      onChange={(e) => setLoginData({...loginData, username: e.target.value})}
                      placeholder="請輸入使用者名稱或 Email"
                      style={styles.input}
                    />
                  </div>

                  <div>
                    <label style={styles.label}>密碼</label>
                    <div style={styles.passwordContainer}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={loginData.password}
                        onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                        placeholder="請輸入密碼"
                        style={{...styles.input, paddingRight: '48px'}}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={styles.passwordToggle}
                      >
                        {showPassword ? (
                          <img src="ic_visibility_off.png" alt="隱藏密碼" style={{width: '20px', height: '20px'}} />
                        ) : (
                          <img src="ic_visibility.png" alt="顯示密碼" style={{width: '20px', height: '20px'}} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div style={styles.linkContainer}>
                    <button 
                      onClick={() => setCurrentSection('forgotPassword')}
                      style={styles.link}
                    >
                      忘記密碼?
                    </button>
                    <button 
                      onClick={() => {
                        if (userType === 'general') {
                          setCurrentSection('generalRegister');
                        } else {
                          setCurrentSection('doctorRegister');
                        }
                      }}
                      style={styles.link}
                    >
                      註冊帳號
                    </button>
                  </div>

                  <button
                    onClick={handleLogin}
                    disabled={loading}
                    style={styles.primaryButton(loading)}
                  >
                    {loading ? '登入中...' : '會員登入'}
                  </button>
                </div>

                <div style={styles.testHint}>
                  {userType === 'general' ? 
                    '一般用戶：帳號是身分證字號，密碼是身分證後六碼 (例: A123456789 / 456789)' : 
                    '醫生：使用 username 和設定的密碼登入'
                  }
                </div>
              </div>
            </div>
          </div>
        );

      case 'generalRegister':
        return (
          <GeneralRegisterPage 
            onBack={() => setCurrentSection('login')}
            onSuccess={(user, email) => {
              setEmailVerification({ email, isVerified: false });
              setCurrentSection('login'); // 直接返回登入頁面
            }}
          />
        );

      case 'doctorRegister':
        return (
          <DoctorRegisterPage 
            onBack={() => setCurrentSection('login')}
            onSuccess={(user, email) => {
              setEmailVerification({ email, isVerified: false });
              setCurrentSection('login'); // 直接返回登入頁面
            }}
          />
        );

      case 'emailVerification':
        return (
          <div style={styles.background}>
            <div style={{...styles.card, maxWidth: '448px', padding: '40px', flexDirection: 'column', display: 'block'}}>
              <div style={styles.textCenter}>
                <button
                  onClick={() => setCurrentSection('generalRegister')}
                  style={{...styles.backButton, ...styles.floatLeft}}
                >
                  <img src="ic_arrow.png" alt="返回" style={{width: '24px', height: '24px'}} />
                </button>
                <div style={styles.clearfix}></div>

                <h2 style={{fontSize: '20px', fontWeight: '600', marginBottom: '24px'}}>信箱驗證</h2>
                
                <div style={styles.emailIcon}>
                  <img src="ic_sendmail.png" alt="信箱圖示" style={{width: '100%', height: '100%'}} />
                </div>

                <p style={{color: '#6B7280', marginBottom: '24px'}}>輸入您的信箱</p>
                <p style={{color: '#1F2937', fontWeight: '500', marginBottom: '32px'}}>
                  {emailVerification.email}
                </p>

                <button
                  onClick={handleSendVerification}
                  disabled={loading}
                  style={styles.primaryButton(loading)}
                >
                  {loading ? '發送中...' : '寄送驗證碼'}
                </button>
              </div>
            </div>
          </div>
        );

      case 'emailSent':
        return (
          <div style={styles.background}>
            <div style={{...styles.card, maxWidth: '448px', padding: '40px', flexDirection: 'column', display: 'block'}}>
              <div style={styles.textCenter}>
                <button
                  onClick={() => setCurrentSection('emailVerification')}
                  style={{...styles.backButton, ...styles.floatLeft}}
                >
                  <img src="ic_arrow.png" alt="返回" style={{width: '24px', height: '24px'}} />
                </button>
                <div style={styles.clearfix}></div>

                <h2 style={{fontSize: '20px', fontWeight: '600', marginBottom: '24px'}}>信箱驗證</h2>
                
                <div style={styles.emailIcon}>
                  <img src="ic_sendmail.png" alt="信箱圖示" style={{width: '100%', height: '100%'}} />
                </div>

                <p style={{color: '#6B7280', marginBottom: '8px'}}>驗證信已發送至</p>
                <p style={{color: '#1F2937', fontWeight: '500', marginBottom: '32px'}}>
                  {emailVerification.email.replace(/(.{2})(.*)(@.*)/, '$1XXXXXXX$3')}
                </p>

                <button
                  onClick={countdown > 0 ? null : handleResendVerification}
                  disabled={countdown > 0}
                  style={styles.secondaryButton(countdown > 0)}
                >
                  {countdown > 0 ? `重新發送(${countdown})` : '重新發送'}
                </button>

                <button
                  onClick={() => setCurrentSection('login')}
                  style={{
                    ...styles.primaryButton(false),
                    marginTop: '16px',
                    backgroundColor: '#6B7280',
                    '&:hover': {
                      backgroundColor: '#4B5563'
                    }
                  }}
                >
                  返回登入
                </button>
              </div>
            </div>
          </div>
        );

      case 'forgotPassword':
        return (
          <div style={styles.background}>
            <div style={{...styles.card, maxWidth: '448px', padding: '40px', flexDirection: 'column', display: 'block'}}>
              <div style={styles.textCenter}>
                <h2 style={{fontSize: '20px', fontWeight: '600', marginBottom: '24px'}}>忘記密碼</h2>
                <p style={{color: '#6B7280', marginBottom: '32px'}}>忘記密碼功能開發中...</p>
                <button
                  onClick={() => setCurrentSection('login')}
                  style={styles.primaryButton(false)}
                >
                  返回登入
                </button>
              </div>
            </div>
          </div>
        );

      case 'dashboard':
        // 根據用戶類型顯示不同的儀表板
        if (user?.user_metadata?.user_type === 'general') {
          // 一般用戶：簡單的歡迎頁面
          return (
            <div style={styles.dashboard}>
              <nav style={styles.navbar}>
                <div style={styles.navContainer}>
                  <div style={styles.navLogo}>
                    <div style={styles.navLogoIcon}>
                      <span style={{color: 'white', fontWeight: 'bold', fontSize: '14px'}}>積</span>
                    </div>
                    <span style={styles.navLogoText}>積木</span>
                  </div>
                  <button 
                    onClick={handleLogout}
                    style={styles.logoutButton}
                  >
                    登出
                  </button>
                </div>
              </nav>

              <div style={styles.dashboardContainer}>
                <div style={styles.dashboardCard}>
                  <h2 style={{fontSize: '24px', fontWeight: 'bold', marginBottom: '24px'}}>歡迎使用積木</h2>
                  <div style={styles.textCenter}>
                    <p style={{color: '#6B7280', marginBottom: '16px'}}>您已成功登入系統</p>
                    <p style={{color: '#1F2937'}}>
                      一般用戶：{user?.user_metadata?.username} ({user?.user_metadata?.full_name})
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        } else {
          // 醫生用戶：使用 DoctorDashboard 組件
          return <DoctorDashboard user={user} onLogout={handleLogout} />;
        }

      default:
        return null;
    }
  };

  return renderSection();
};

export default JimuApp;