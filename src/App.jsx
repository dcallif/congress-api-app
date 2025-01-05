import React, { useState, useEffect, useRef, useMemo } from 'react';
    import ReactDOM from 'react-dom';

    const API_KEY = 'FvJd28wc1hX7lC67eupzx3bqfqjFyaTPINfXG4cE';
    const API_URL = 'https://api.congress.gov/v3/summaries';
    const PAGE_SIZES = [10, 25, 50, 100];
    const DEFAULT_FILTER_TERMS = ["Congratulating", "Recognizing", "Expressing support", "Commemorating", "Condemning", "Acknowledging", "Designating", "To Name", "Honoring"];

    function formatDate(dateString) {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    }

    function Modal({ bill, onClose, isOpen }) {
      const modalRef = useRef();
      const [billData, setBillData] = useState(null);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState(null);
      const [showBillData, setShowBillData] = useState(false);

      useEffect(() => {
        function handleClickOutside(event) {
          if (modalRef.current && !modalRef.current.contains(event.target)) {
            onClose();
          }
        }

        if (isOpen) {
          document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
        };
      }, [onClose, isOpen]);

      useEffect(() => {
        const fetchBillData = async () => {
          if (bill?.bill?.url && showBillData) {
            setLoading(true);
            try {
              const response = await fetch(`${bill.bill.url}&api_key=${API_KEY}`);
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              const jsonData = await response.json();
              setBillData(jsonData);
            } catch (err) {
              setError(err.message);
            } finally {
              setLoading(false);
            }
          }
        };
        fetchBillData();
      }, [bill?.bill?.url, showBillData]);

      const renderBillData = (data, level = 0) => {
        if (!data) return null;
        const indent = '  '.repeat(level);
        if (typeof data !== 'object' || data === null) {
          return <p style={{ marginLeft: indent }}>{data}</p>;
        }
        if (Array.isArray(data)) {
          return data.map((item, index) => (
            <div key={index} style={{ marginLeft: indent }}>
              {renderBillData(item, level + 1)}
            </div>
          ));
        }
        return Object.entries(data).map(([key, value]) => (
          <div key={key} className="modal-section">
            <h3 style={{ marginLeft: indent }}>{key}</h3>
            {typeof value === 'object' ? (
              <table className="modal-table">
                <tbody>
                  {Object.entries(value).map(([k, v]) => (
                    <tr key={k}>
                      <th>{k}</th>
                      <td>{JSON.stringify(v, null, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ marginLeft: indent }}>{value}</p>
            )}
          </div>
        ));
      };

      const handleMoreDetailsClick = () => {
        setShowBillData(true);
      };

      return ReactDOM.createPortal(
        <div className="modal-overlay" style={{ zIndex: 1001 }}>
          <div className="modal-content" ref={modalRef}>
            <h2>Bill Details</h2>

            <div className="modal-section">
              <h3>Bill Information</h3>
              <table className="modal-table">
                <tbody>
                  <tr>
                    <th>Bill Number</th>
                    <td>{bill.bill?.number}</td>
                  </tr>
                  <tr>
                    <th>Origin Chamber</th>
                    <td>{bill.bill?.originChamber}</td>
                  </tr>
                  <tr>
                    <th>Title</th>
                    <td>{bill.bill?.title}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="modal-section">
              <h3>Summary Information</h3>
              <table className="modal-table">
                <tbody>
                  <tr>
                    <th>Summary Action Date</th>
                    <td>{formatDate(bill.actionDate)}</td>
                  </tr>
                  <tr>
                    <th>Update Date</th>
                    <td>{formatDate(bill.updateDate)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="modal-section">
              <h3>Text</h3>
              <div dangerouslySetInnerHTML={{ __html: bill.text }} />
            </div>

            <div className="modal-section">
              {bill?.bill?.url && (
                <button onClick={handleMoreDetailsClick}>More Details</button>
              )}
              {loading && <p>Loading...</p>}
              {error && <p>Error: {error}</p>}
              {!loading && !error && billData && renderBillData(billData)}
            </div>

            <button className="close-button" onClick={onClose}>
              &times;
            </button>
          </div>
        </div>,
        document.getElementById('modal-container')
      );
    }

    function App() {
      const [bills, setBills] = useState([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [selectedBillId, setSelectedBillId] = useState(null);
      const [selectedBill, setSelectedBill] = useState(null);
      const [isModalOpen, setIsModalOpen] = useState(false);
      const [startDate, setStartDate] = useState(() => {
        const today = new Date();
        const lastMonth = new Date(today);
        lastMonth.setMonth(today.getMonth() - 1);
        return lastMonth.toISOString().split('T')[0];
      });
      const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
      const [offset, setOffset] = useState(0);
      const [currentPage, setCurrentPage] = useState(1);
      const [totalPages, setTotalPages] = useState(1);
      const [pageSize, setPageSize] = useState(25);
      const [sortColumn, setSortColumn] = useState(null);
      const [sortOrder, setSortOrder] = useState('asc');
      const backToTopButtonRef = useRef(null);
      const [searchKeywords, setSearchKeywords] = useState('');
      const [allBills, setAllBills] = useState([]);
      const [totalBillCount, setTotalBillCount] = useState(0);
      const [isFetching, setIsFetching] = useState(false);
      const [filterTerms, setFilterTerms] = useState(DEFAULT_FILTER_TERMS);
      const [additionalFilter, setAdditionalFilter] = useState('');

      useEffect(() => {
        const fetchAllBills = async () => {
          setIsFetching(true);
          try {
            const formatDateForAPI = (date) => {
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}T00:00:00Z`;
            };

            const fromDateTime = formatDateForAPI(new Date(startDate));
            const toDateTime = formatDateForAPI(new Date(endDate));
            const sort = 'updateDate+asc';

            let allData = [];
            let currentOffset = 0;

            const fetchPage = async (offset) => {
              const url = `${API_URL}?api_key=${API_KEY}&fromDateTime=${fromDateTime}&toDateTime=${toDateTime}&sort=${sort}&offset=${offset}&limit=100`;
              const response = await fetch(url);
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              const data = await response.json();
              allData = allData.concat(data.summaries || []);
              if (data.summaries && data.summaries.length === 100) {
                await fetchPage(offset + 100);
              }
            };

            await fetchPage(0);
            setAllBills(allData);
          } catch (err) {
            setError(err.message);
          } finally {
            setIsFetching(false);
          }
        };

        fetchAllBills();
      }, [startDate, endDate]);

      useEffect(() => {
        let filteredBills = allBills;
        if (searchKeywords) {
          const keywords = searchKeywords.toLowerCase().split(/\s+/).filter(Boolean);
          filteredBills = filteredBills.filter(bill => {
            if (!bill.bill?.title) return false;
            const title = bill.bill.title.toLowerCase();
            return keywords.some(keyword => title.includes(keyword));
          });
        }
        filteredBills = filteredBills.filter(bill => {
          if (!bill.bill?.title) return true;
          const title = bill.bill.title.toLowerCase();
          return !filterTerms.some(term => title.includes(term.toLowerCase()));
        });
        setBills(filteredBills);
        setTotalPages(Math.ceil(filteredBills.length / pageSize));
        setTotalBillCount(filteredBills.length);
        setOffset(0);
        setCurrentPage(1);
      }, [allBills, pageSize, searchKeywords, filterTerms]);

      useEffect(() => {
        const handleScroll = () => {
          if (backToTopButtonRef.current) {
            if (window.scrollY > 200) {
              backToTopButtonRef.current.classList.add('show');
            } else {
              backToTopButtonRef.current.classList.remove('show');
            }
          }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
      }, []);

      const handleBackToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      const handleRowClick = (bill) => {
        setSelectedBillId(bill.bill?.billId);
        setSelectedBill(bill);
        setIsModalOpen(true);
      };

      const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedBillId(null);
      };

      const handleStartDateChange = (event) => {
        setStartDate(event.target.value);
      };

      const handleEndDateChange = (event) => {
        setEndDate(event.target.value);
      };

      const handlePageSizeChange = (event) => {
        setPageSize(parseInt(event.target.value, 10));
        setOffset(0);
        setCurrentPage(1);
      };

      const handlePageClick = (page) => {
        setOffset((page - 1) * pageSize);
        setCurrentPage(page);
      };

      const handleNextPage = () => {
        setOffset(prevOffset => prevOffset + pageSize);
        setCurrentPage(prevPage => prevPage + 1);
      };

      const handlePrevPage = () => {
        setOffset(prevOffset => Math.max(0, prevOffset - pageSize));
        setCurrentPage(prevPage => Math.max(1, prevPage - 1));
      };

      const handleFirstPage = () => {
        setOffset(0);
        setCurrentPage(1);
      };

      const handleLastPage = () => {
        setOffset((totalPages - 1) * pageSize);
        setCurrentPage(totalPages);
      };

      const handleSort = (column) => {
        if (column === 'title') return;
        if (sortColumn === column) {
          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
          setSortColumn(column);
          setSortOrder('asc');
        }
      };

      const handleSearchChange = (event) => {
        setSearchKeywords(event.target.value);
        setOffset(0);
        setCurrentPage(1);
      };

      const handleAddFilterTerm = () => {
        if (additionalFilter.trim() !== '') {
          setFilterTerms(prevTerms => [...prevTerms, additionalFilter.trim()]);
          setAdditionalFilter('');
        }
      };

      const handleRemoveFilterTerm = (termToRemove) => {
        setFilterTerms(prevTerms => prevTerms.filter(term => term !== termToRemove));
      };

      const renderPageButtons = () => {
        if (totalPages <= 1) return null;
        return (
          <>
            <button onClick={handleFirstPage} disabled={currentPage === 1}>
              First
            </button>
            <button onClick={handlePrevPage} disabled={currentPage === 1}>
              Previous
            </button>
            <span className="current-page">{currentPage}</span>
            <button onClick={handleNextPage} disabled={currentPage === totalPages || displayedBills.length < pageSize}>
              Next
            </button>
            <button onClick={handleLastPage} disabled={currentPage === totalPages}>
              Last
            </button>
          </>
        );
      };

      const displayedBills = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        const sortedBills = [...bills].sort((a, b) => {
          if (!sortColumn) return 0;
          const aValue = a.bill?.[sortColumn] || a[sortColumn] || '';
          const bValue = b.bill?.[sortColumn] || b[sortColumn] || '';
          if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
        return sortedBills.slice(start, end);
      }, [bills, currentPage, pageSize, sortColumn, sortOrder]);

      return (
        <div className="container">
          <h1>
            <span role="img" aria-label="us-capitol">🏛️</span> US Legislative Bills
          </h1>
          <div className="date-inputs">
            <label htmlFor="startDate">Start Date:</label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={handleStartDateChange}
            />
            <label htmlFor="endDate">End Date:</label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={handleEndDateChange}
            />
          </div>
          <div className="table-container">
            <div className="table-header">
              <div className="page-size-selector">
                <label htmlFor="pageSize">Items per page:</label>
                <select id="pageSize" value={pageSize} onChange={handlePageSizeChange}>
                  {PAGE_SIZES.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
              <div className="search-container">
                <input
                  type="text"
                  placeholder="Search by keywords"
                  className="search-input"
                  value={searchKeywords}
                  onChange={handleSearchChange}
                />
                <p className="bill-count">Total Bills: {totalBillCount}</p>
              </div>
            </div>
            <div className="filter-terms">
              {filterTerms.map(term => (
                <span key={term}>
                  {term}
                  <button onClick={() => handleRemoveFilterTerm(term)}>x</button>
                </span>
              ))}
            </div>
            <div className="search-container">
              <input
                type="text"
                placeholder="Add filter term"
                className="search-input"
                value={additionalFilter}
                onChange={(e) => setAdditionalFilter(e.target.value)}
              />
              <button onClick={handleAddFilterTerm}>Add</button>
            </div>
            {isFetching ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
              </div>
            ) : (
              <table className="main-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('number')} className={sortColumn === 'number' ? `sorted ${sortOrder}` : ''}>Bill Number</th>
                    <th onClick={() => handleSort('actionDate')} className={sortColumn === 'actionDate' ? `sorted ${sortOrder}` : ''}>Summary Action Date</th>
                    <th onClick={() => handleSort('updateDate')} className={sortColumn === 'updateDate' ? `sorted ${sortOrder}` : ''}>Update Date</th>
                    <th onClick={() => handleSort('originChamber')} className={sortColumn === 'originChamber' ? `sorted ${sortOrder}` : ''}>Origin Chamber</th>
                    <th>Title</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedBills.map((bill) => (
                    <tr
                      key={bill.bill?.billId}
                      onClick={() => handleRowClick(bill)}
                      className={selectedBillId === bill.bill?.billId ? 'selected' : ''}
                    >
                      <td>{bill.bill?.number}</td>
                      <td>{formatDate(bill.actionDate)}</td>
                      <td>{formatDate(bill.updateDate)}</td>
                      <td>{bill.bill?.originChamber}</td>
                      <td>{bill.bill?.title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="pagination-buttons">
            {renderPageButtons()}
          </div>
          {isModalOpen && selectedBill && (
            <Modal bill={selectedBill} onClose={handleCloseModal} isOpen={isModalOpen} />
          )}
          <button ref={backToTopButtonRef} id="back-to-top" onClick={handleBackToTop}>
            &#8679;
          </button>
        </div>
      );
    }

    export default App;
