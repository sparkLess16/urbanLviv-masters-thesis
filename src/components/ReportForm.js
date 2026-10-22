import { useState, useRef, useEffect } from "react";
import axios from "axios";
import "../styles/ReportForm.css";
import ConfirmDialog from "./ConfirmDialog";
import LocationPicker from "./LocationPicker";
import MyLocationButton from "./MyLocationButton";
import Select from "./Select";
import { useLocationAutofill } from "../hooks/useLocationAutofill";

const ReportForm = ({ onSubmitted }) => {
  const [title, setTitle] = useState("");
  const [priorityId, setPriorityId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [coordinates, setCoordinates] = useState(null);
  const [districtId, setDistrictId] = useState("");
  const [districts, setDistricts] = useState([]);
  const [photoInputs, setPhotoInputs] = useState([0]);
  const [previews, setPreviews] = useState({});
  const [attachments, setAttachments] = useState({});
  const [priorities, setPriorities] = useState([]);
  const [types, setTypes] = useState([]);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRefs = useRef({});
  const [errors, setErrors] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const {
    pickPoint,
    locate,
    isLocating,
    hint: locationHint,
    onLocationTyped,
    searchAddress,
  } = useLocationAutofill({
    setCoordinates,
    setDistrictId,
    setAddress: setLocation,
  });

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    axios
      .get("http://localhost:5000/api/reports/priorities", { headers })
      .then((res) => {
        setPriorities(res.data);
      })
      .catch((err) => {
        console.error("Failed to load priorities", err);
        setError("Не вдалося завантажити пріоритети");
      });

    axios
      .get("http://localhost:5000/api/reports/types", { headers })
      .then((res) => {
        setTypes(res.data);
      })
      .catch((err) => {
        console.error("Failed to load problem types", err);
        setError("Не вдалося завантажити типи проблем");
      });

    axios
      .get("http://localhost:5000/api/reports/districts", { headers })
      .then((res) => {
        setDistricts(res.data);
      })
      .catch((err) => {
        console.error("Failed to load districts", err);
      });
  }, []);

  const handlePhotoClick = (index) => {
    inputRefs.current[index]?.click();
  };

  const handlePhotoChange = (e, index) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;

      setPreviews((prev) => ({ ...prev, [index]: dataUrl }));
      setAttachments((prev) => ({
        ...prev,
        [index]: file,
      }));

      setPhotoInputs((prevInputs) => {
        const allUsed = prevInputs.every((id) => previews[id] || id === index);
        if (allUsed) {
          return [
            ...prevInputs,
            prevInputs.length ? Math.max(...prevInputs) + 1 : 1,
          ];
        }
        return prevInputs;
      });
    };

    reader.readAsDataURL(file);
  };

  const submitReport = async () => {
    setIsSubmitting(true);
    setError(null);

    const newErrors = {};
    if (!title.trim()) newErrors.title = "Enter a short title";
    if (!priorityId) newErrors.priority = "Choose how urgent it is";
    if (!typeId) newErrors.type = "Choose a problem type";
    if (!description.trim()) newErrors.description = "Describe the problem";
    if (!location.trim()) newErrors.location = "Enter the address";
    if (!districtId) newErrors.district = "Choose a district";
    if (!coordinates) newErrors.coordinates = "Mark the place on the map";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsSubmitting(false);
      return;
    }

    setErrors({});

    try {
      const formData = new FormData();

      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("location", location.trim());
      formData.append("district_id", districtId);
      formData.append("lat", coordinates.lat);
      formData.append("lng", coordinates.lng);
      formData.append("priority_id", priorityId);
      formData.append("type_id", typeId);

      Object.values(attachments).forEach((file) => {
        formData.append("photos", file);
      });

      const token = localStorage.getItem("authToken");
      await axios.post("http://localhost:5000/api/reports", formData, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      setShowConfirm(true);
      if (onSubmitted) {
        onSubmitted();
      }
      setTitle("");
      setPriorityId("");
      setTypeId("");
      setDescription("");
      setLocation("");
      setCoordinates(null);
      setDistrictId("");
      setPreviews({});
      setAttachments({});
      setPhotoInputs([0]);
      setErrors({});
    } catch (err) {
      console.error("Create report failed", err);
      setError("Не вдалося створити звіт");
    } finally {
      setIsSubmitting(false);
    }
  };
  const requestPhotoDelete = (id) => {
    setConfirmDeleteId(id);
    setShowDeleteDialog(true);
  };

  const confirmPhotoDelete = () => {
    if (confirmDeleteId !== null) {
      const newPreviews = { ...previews };
      const newAttachments = { ...attachments };

      delete newPreviews[confirmDeleteId];
      delete newAttachments[confirmDeleteId];

      setPreviews(newPreviews);
      setAttachments(newAttachments);
      setPhotoInputs((prevInputs) =>
        prevInputs.filter((id) => id !== confirmDeleteId),
      );
      setShowDeleteDialog(false);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="rf-card">
      <div className="rf-header">
        <h2 className="addRep">
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
          Report a problem
        </h2>
      </div>

      <div className="rf-body">
        {error && <div className="error-message">{error}</div>}

        <div className="rf-field">
          <LocationPicker
            compact
            value={coordinates}
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
            <label className="rf-label" htmlFor="rf-location">
              Address
            </label>
            <input
              id="rf-location"
              type="text"
              placeholder="Street and building, e.g. 12 Stusa Street"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
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
            <label className="rf-label" htmlFor="rf-district">
              District
            </label>
            <Select
              id="rf-district"
              value={districtId}
              onChange={setDistrictId}
              options={districts.map((o) => ({ value: o.id, label: o.name }))}
              placeholder="Select district"
            />
            {errors.district && (
              <span className="rf-error">{errors.district}</span>
            )}
          </div>
        </div>

        <div className="rf-field">
          <label className="rf-label" htmlFor="rf-title">
            Short title
          </label>
          <input
            id="rf-title"
            type="text"
            value={title}
            placeholder="Short summary, e.g. Pothole on the road"
            onChange={(e) => setTitle(e.target.value)}
          />
          {errors.title && <span className="rf-error">{errors.title}</span>}
        </div>

        <div className="rf-row">
          <div className="rf-field">
            <label className="rf-label" htmlFor="rf-type">
              Problem type
            </label>
            <Select
              id="rf-type"
              value={typeId}
              onChange={setTypeId}
              options={types.map((o) => ({ value: o.id, label: o.name }))}
              placeholder="Select problem type"
            />
            {errors.type && <span className="rf-error">{errors.type}</span>}
          </div>
          <div className="rf-field">
            <label className="rf-label" htmlFor="rf-priority">
              Urgency
            </label>
            <Select
              id="rf-priority"
              value={priorityId}
              onChange={setPriorityId}
              options={priorities.map((o) => ({ value: o.id, label: o.name }))}
              placeholder="Select urgency"
            />
            {errors.priority && (
              <span className="rf-error">{errors.priority}</span>
            )}
          </div>
        </div>

        <div className="rf-field">
          <label className="rf-label" htmlFor="rf-description">
            Description
          </label>
          <textarea
            id="rf-description"
            rows={3}
            value={description}
            placeholder="Describe what happened and who it affects"
            onChange={(e) => setDescription(e.target.value)}
          />
          {errors.description && (
            <span className="rf-error">{errors.description}</span>
          )}
        </div>

        <div className="rf-field">
          <span className="rf-label">Photos (optional)</span>
          <div id="photoContainer" className="rf-photos">
            {photoInputs.map((id) => (
              <div
                key={id}
                className="rf-photo-tile"
                onClick={() => handlePhotoClick(id)}
              >
                {previews[id] ? (
                  <div className="image-preview-wrapper">
                    <img src={previews[id]} alt="Preview" className="preview" />
                    <button
                      type="button"
                      className="delete-btn"
                      aria-label="Remove photo"
                      onClick={(e) => {
                        e.stopPropagation();
                        requestPhotoDelete(id);
                      }}
                    >
                      &times;
                    </button>
                  </div>
                ) : (
                  <span aria-label="Add photo">+</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  ref={(el) => (inputRefs.current[id] = el)}
                  onChange={(e) => handlePhotoChange(e, id)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rf-footer">
        <button
          className="rf-submit"
          onClick={submitReport}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "Submit report"}
        </button>
      </div>
      {showConfirm && (
        <ConfirmDialog
          message={["Report created successfully"]}
          buttons={[
            {
              label: "Okay",
              variant: "danger",
              onClick: () => {
                setShowConfirm(false);
                if (onSubmitted) onSubmitted();
              },
            },
          ]}
        />
      )}
      {showDeleteDialog && (
        <ConfirmDialog
          message={[
            "Are you sure you want to delete this photo?",
            "This action cannot be undone.",
          ]}
          buttons={[
            {
              label: "Cancel",
              onClick: () => {
                setShowDeleteDialog(false);
                setConfirmDeleteId(null);
              },
            },
            {
              label: "Delete",
              variant: "danger",
              onClick: confirmPhotoDelete,
            },
          ]}
        />
      )}
    </div>
  );
};

export default ReportForm;
