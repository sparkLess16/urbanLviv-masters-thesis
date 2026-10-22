import React, { useEffect, useState } from "react";
import axios from "axios";
import "../styles/ReportForm.css";
import "../styles/EditModal.css";
import ConfirmDialog from "./ConfirmDialog";
import LocationPicker from "./LocationPicker";
import MyLocationButton from "./MyLocationButton";
import Select from "./Select";
import { useLocationAutofill } from "../hooks/useLocationAutofill";

const EditModal = ({
  isOpen,
  onClose,
  reportData,
  priorities = [],
  types = [],
  photoInputs = [],
  previews,
  inputRefs,
  handlePhotoClick,
  handlePhotoChange,
  isSubmitting,
  onSubmitted,
}) => {
  const [editedTitle, setEditedTitle] = useState(reportData?.title || "");
  const [editedDescription, setEditedDescription] = useState(
    reportData?.description || "",
  );
  const [editedPlace, setEditedPlace] = useState(reportData?.location || "");
  const [editedDistrict, setEditedDistrict] = useState(
    reportData?.district_id || "",
  );
  const [editedCoordinates, setEditedCoordinates] = useState(
    reportData?.coordinates || null,
  );
  const [districts, setDistricts] = useState([]);
  const [editedPriority, setEditedPriority] = useState(
    reportData?.priority_id || "",
  );
  const [editedType, setEditedType] = useState(reportData?.type_id || "");
  const [attachments, setAttachments] = useState({});
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [isSubmit, setIsSubmit] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const {
    pickPoint,
    locate,
    isLocating,
    hint: locationHint,
    onLocationTyped,
    searchAddress,
  } = useLocationAutofill({
    setCoordinates: setEditedCoordinates,
    setDistrictId: setEditedDistrict,
    setAddress: setEditedPlace,
  });

  useEffect(() => {
    if (reportData) {
      setEditedTitle(reportData.title);
      setEditedDescription(reportData.description);
      setEditedPlace(reportData.location);
      setEditedDistrict(reportData.district_id);
      setEditedCoordinates(reportData.coordinates || null);
      setEditedPriority(reportData.priority_id);
      setEditedType(reportData.type_id);
    }
  }, [reportData]);

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/reports/districts")
      .then((res) => {
        setDistricts(res.data);
      })
      .catch((err) => {
        console.error("Failed to load districts", err);
      });
  }, []);

  if (!isOpen && !showSuccessDialog) return null;

  if (showSuccessDialog) {
    return (
      <ConfirmDialog
        message={["Your report has been successfully updated."]}
        buttons={[
          {
            label: "Okay",
            variant: "primary",
            onClick: () => {
              setShowSuccessDialog(false);
            },
          },
        ]}
      />
    );
  }

  const submitReport = async () => {
    setIsSubmit(true);
    setError(null);

    const newErrors = {};
    if (!editedTitle.trim()) newErrors.title = "Enter a short title";
    if (!editedPriority) newErrors.priority = "Choose how urgent it is";
    if (!editedType) newErrors.type = "Choose a problem type";
    if (!editedDescription.trim())
      newErrors.description = "Describe the problem";
    if (!editedPlace.trim()) newErrors.location = "Enter the address";
    if (!editedDistrict) newErrors.district = "Choose a district";
    if (!editedCoordinates) newErrors.coordinates = "Mark the place on the map";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsSubmit(false);
      return;
    }

    try {
      const body = {
        title: editedTitle.trim(),
        description: editedDescription.trim(),
        location: editedPlace.trim(),
        district_id: editedDistrict,
        lat: editedCoordinates.lat,
        lng: editedCoordinates.lng,
        priority_id: editedPriority,
        type_id: editedType,
      };

      const token = localStorage.getItem("authToken");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      await axios.put(
        `http://localhost:5000/api/reports/${reportData.reportId}`,
        body,
        { headers },
      );

      if (onSubmitted) onSubmitted();
      onClose();
      setShowSuccessDialog(true);
      setEditedTitle("");
      setEditedPriority("");
      setEditedType("");
      setEditedDescription("");
      setEditedPlace("");
      setErrors({});
    } catch (err) {
      setError("Edit report failed");
    } finally {
      setIsSubmit(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop">
        <div className="rf-card rf-modal">
          <div className="rf-header">
            <h2 className="addRep edit-modal">
              <svg
                width="28"
                height="28"
                viewBox="0 0 36 36"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <rect width="36" height="36" rx="7" fill="white" />
                <path
                  d="M22 28.75H9C8.04 28.75 7.25 27.96 7.25 27V14C7.25 9.58 9.58 7.25 14 7.25H22C26.42 7.25 28.75 9.58 28.75 14V22C28.75 26.42 26.42 28.75 22 28.75ZM14 8.75C10.42 8.75 8.75 10.42 8.75 14V27C8.75 27.14 8.86 27.25 9 27.25H22C25.58 27.25 27.25 25.58 27.25 22V14C27.25 10.42 25.58 8.75 22 8.75H14Z"
                  fill="#292D32"
                />
                <path
                  d="M21.5 18.75H14.5C14.09 18.75 13.75 18.41 13.75 18C13.75 17.59 14.09 17.25 14.5 17.25H21.5C21.91 17.25 22.25 17.59 22.25 18C22.25 18.41 21.91 18.75 21.5 18.75Z"
                  fill="#292D32"
                />
                <path
                  d="M18 22.25C17.59 22.25 17.25 21.91 17.25 21.5V14.5C17.25 14.09 17.59 13.75 18 13.75C18.41 13.75 18.75 14.09 18.75 14.5V21.5C18.75 21.91 18.41 22.25 18 22.25Z"
                  fill="#292D32"
                />
              </svg>
              Edit report
            </h2>

            <button
              className="close-modal-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <svg
                width="36"
                height="36"
                viewBox="0 0 36 36"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <rect width="36" height="36" rx="7" fill="black" />
                <path
                  d="M12 12L18 18M24 24L18 18M18 18L24 12M18 18L12 24"
                  stroke="white"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
          </div>

          <div className="rf-body">
            {error && <div className="error-message">{error}</div>}

            <div className="rf-field">
              <LocationPicker
                compact
                value={editedCoordinates}
                onChange={pickPoint}
                notice={locationHint}
                overlay={
                  <MyLocationButton onClick={locate} isLocating={isLocating} />
                }
              />
              {errors.coordinates && (
                <span className="rf-error">{errors.coordinates}</span>
              )}
            </div>

            <div className="rf-row">
              <div className="rf-field rf-field-grow">
                <label className="rf-label" htmlFor="ef-location">
                  Address
                </label>
                <input
                  id="ef-location"
                  type="text"
                  placeholder="Street and building, e.g. 12 Stusa Street"
                  value={editedPlace}
                  onChange={(e) => {
                    setEditedPlace(e.target.value);
                    onLocationTyped();
                  }}
                  onBlur={(e) => searchAddress(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") searchAddress(e.target.value);
                  }}
                />
                {errors.location && (
                  <span className="rf-error">{errors.location}</span>
                )}
              </div>
              <div className="rf-field">
                <label className="rf-label" htmlFor="ef-district">
                  District
                </label>
                <Select
                  id="ef-district"
                  value={editedDistrict}
                  onChange={setEditedDistrict}
                  options={districts.map((o) => ({
                    value: o.id,
                    label: o.name,
                  }))}
                  placeholder="Select district"
                />
                {errors.district && (
                  <span className="rf-error">{errors.district}</span>
                )}
              </div>
            </div>

            <div className="rf-field">
              <label className="rf-label" htmlFor="ef-title">
                Short title
              </label>
              <input
                id="ef-title"
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
              />
              {errors.title && <span className="rf-error">{errors.title}</span>}
            </div>

            <div className="rf-row">
              <div className="rf-field">
                <label className="rf-label" htmlFor="ef-type">
                  Problem type
                </label>
                <Select
                  id="ef-type"
                  value={editedType}
                  onChange={setEditedType}
                  options={types.map((o) => ({ value: o.id, label: o.name }))}
                  placeholder="Select problem type"
                />
                {errors.type && <span className="rf-error">{errors.type}</span>}
              </div>
              <div className="rf-field">
                <label className="rf-label" htmlFor="ef-priority">
                  Urgency
                </label>
                <Select
                  id="ef-priority"
                  value={editedPriority}
                  onChange={setEditedPriority}
                  options={priorities.map((o) => ({
                    value: o.id,
                    label: o.name,
                  }))}
                  placeholder="Select urgency"
                />
                {errors.priority && (
                  <span className="rf-error">{errors.priority}</span>
                )}
              </div>
            </div>

            <div className="rf-field">
              <label className="rf-label" htmlFor="ef-description">
                Description
              </label>
              <textarea
                id="ef-description"
                rows={3}
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
              />
              {errors.description && (
                <span className="rf-error">{errors.description}</span>
              )}
            </div>
          </div>

          <div className="rf-footer">
            <button
              className="rf-submit"
              onClick={submitReport}
              disabled={isSubmitting || isSubmit}
            >
              {isSubmitting || isSubmit ? "Submitting..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default EditModal;
